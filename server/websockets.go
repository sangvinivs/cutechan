/*
 Websocket server and client controler struct
*/

package server

import (
	"errors"
	"fmt"
	"github.com/gorilla/websocket"
	"log"
	"net/http"
	"sync"
	"time"
)

// uint8 identifiers for various message types
// 1 - 29 modify post model state
const (
	messageInvalid = iota
	messageInsertThread
	messageInsertPost
)

// >= 30 are miscelenious and do not write to post models
const (
	messageSynchronise = 30 + iota
	messageSwitchSync
)

var upgrader = websocket.Upgrader{
	HandshakeTimeout: 5 * time.Second,
}

func websocketHandler(res http.ResponseWriter, req *http.Request) {
	conn, err := upgrader.Upgrade(res, req, nil)
	if _, ok := err.(websocket.HandshakeError); ok {
		http.Error(
			res,
			`Can only Upgrade to the Websocket protocol`,
			http.StatusBadRequest,
		)
		return
	} else if err != nil {
		res.WriteHeader(http.StatusInternalServerError)
		return
	}
	c := NewClient(conn, req)
	go c.receiverLoop()
	c.listen()
}

// Client stores and manages a websocket-connected remote client and its
// interaction with the server and database. Do not use any of the methods on
// this struct and only pass messages to the Receiver, Sender and Closer
// channels.
type Client struct {
	synced bool
	closed bool
	ident  Ident
	sync.Mutex
	id       string
	conn     *websocket.Conn
	Receiver chan []byte
	Sender   chan []byte
	Closer   chan websocket.CloseError
}

//

// NewClient creates a new websocket client
func NewClient(conn *websocket.Conn, req *http.Request) *Client {
	return &Client{
		id:       randomID(32),
		ident:    lookUpIdent(req.RemoteAddr),
		Receiver: make(chan []byte),
		Sender:   make(chan []byte),
		Closer:   make(chan websocket.CloseError),
		conn:     conn,
	}
}

// listen listens for incoming messages on the Receiver, Sender and Closer
// channels and processes them sequentially
func (c *Client) listen() error {
	for c.isOpen() {
		select {
		case msg := <-c.Closer:
			return c.close(msg.Code, msg.Text)
		case msg := <-c.Receiver:
			if err := c.receive(msg); err != nil {
				return err
			}
		case msg := <-c.Sender:
			if err := c.send(msg); err != nil {
				return err
			}
		}
	}
	return nil
}

// Thread-safe way of checking, if the websocket connection is open
func (c *Client) isOpen() bool {
	c.Lock()
	defer c.Unlock()
	return !c.closed
}

// Set client to closed in a thread-safe way. Seperated for cleaner testing.
func (c *Client) setClosed() {
	c.Lock()
	c.closed = true
	c.Unlock()
}

// Convert the blocking websocket.Conn.ReadMessage() into a channel stream and
// handle errors
func (c *Client) receiverLoop() error {
	for c.isOpen() {
		typ, message, err := c.conn.ReadMessage() // Blocking
		switch {
		case !c.isOpen(): // Closed, while waiting for message
			return nil
		case err != nil:
			return err
		case typ != websocket.BinaryMessage:
			c.Closer <- websocket.CloseError{
				Code: websocket.CloseUnsupportedData,
				Text: "Only binary frames allowed",
			}
			return errors.New("Client sent text frames")
		default:
			c.Receiver <- message
		}
	}
	return nil
}

// receive parses a message received from the client through websockets
func (c *Client) receive(msg []byte) error {
	if c.ident.Banned {
		return c.close(websocket.ClosePolicyViolation, "You are banned")
	}
	if len(msg) < 2 {
		return c.protocolError(msg)
	}
	typ := uint8(msg[0])
	if !c.synced && typ != messageSynchronise {
		return c.protocolError(msg)
	}

	data := msg[1:]
	var err error
	switch typ {
	case messageInsertThread:
		// TODO: Actual handlers
		fmt.Println(data)
	default:
		err = c.protocolError(msg)
	}
	return err
}

// protocolError handles malformed messages received from the client
func (c *Client) protocolError(msg []byte) error {
	errMsg := fmt.Sprintf("Invalid message: %s", msg)
	if err := c.close(websocket.CloseProtocolError, errMsg); err != nil {
		return wrapError{errMsg, err}
	}
	return errors.New(errMsg)
}

// logError writes the client's websocket error to the error log (or stdout)
func (c *Client) logError(err error) {
	log.Printf("Error by %s: %v\n", c.ident.IP, err)
}

// send sends a provided message as a websocket frame to the client
func (c *Client) send(msg []byte) error {
	return c.conn.WriteMessage(websocket.BinaryMessage, msg)
}

// close closes a websocket connection with the provided status code and
// optional reason
func (c *Client) close(status int, reason string) error {
	err := c.conn.WriteControl(
		websocket.CloseMessage,
		websocket.FormatCloseMessage(status, reason),
		time.Now().Add(time.Second*5),
	)
	c.setClosed()
	if err != nil {
		return err
	}
	return c.conn.Close()
}
