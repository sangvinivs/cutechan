package db

import (
	"database/sql"
	"errors"
	"time"

	"github.com/bakape/meguca/auth"
	"github.com/bakape/meguca/common"
	"github.com/bakape/meguca/config"
)

// Common errors
var (
	ErrUserNameTaken = errors.New("user name already taken")
)

// IsLoggedIn check if the user is logged in with the specified session
func IsLoggedIn(user, session string) (loggedIn bool, err error) {
	if len(user) > common.MaxLenUserID || len(session) != common.LenSession {
		err = common.ErrInvalidCreds
		return
	}

	err = prepared["is_logged_in"].QueryRow(user, session).Scan(&loggedIn)
	if err == sql.ErrNoRows {
		err = nil
	}
	return
}

// RegisterAccount writes the ID and password hash of a new user account to the
// database
func RegisterAccount(ID string, hash []byte) error {
	err := execPrepared("register_account", ID, hash)
	if IsConflictError(err) {
		return ErrUserNameTaken
	}
	return err
}

// GetPassword retrieves the login password hash of the registered user account
func GetPassword(id string) (hash []byte, err error) {
	err = prepared["get_password"].QueryRow(id).Scan(&hash)
	return
}

// FindPosition returns the first matching position of a user on a certain
// board. As a special case the admin user will always return "admin". If none
// found, returns empty string
func FindPosition(board, userID string) (pos string, err error) {
	if userID == "admin" {
		return userID, nil
	}
	err = prepared["find_position"].QueryRow(board, userID).Scan(&pos)
	return
}

// WriteLoginSession writes a new user login session to the DB
func WriteLoginSession(account, token string) error {
	expiryTime := time.Duration(config.Get().SessionExpiry) * time.Hour * 24
	return execPrepared(
		"write_login_session",
		account,
		token,
		time.Now().Add(expiryTime),
	)
}

// LogOut logs the account out of one specific session
func LogOut(account, token string) error {
	return execPrepared("log_out", account, token)
}

// LogOutAll logs an account out of all user sessions
func LogOutAll(account string) error {
	return execPrepared("log_out_all", account)
}

// ChangePassword changes an existing user's login password
func ChangePassword(account string, hash []byte) error {
	return execPrepared("change_password", account, hash)
}

// GetPosition returns the staff position a user is holding on a board
func GetPosition(account, board string) (pos string, err error) {
	err = prepared["get_position"].QueryRow(account, board).Scan(&pos)
	if err == sql.ErrNoRows {
		err = nil
	}
	return
}

// Ban IPs from accessing a specific board. Need to target posts. Returns all
// banned IPs.
func Ban(board, reason, by string, expires time.Time, ids ...uint64) (
	ips map[string]bool, err error,
) {
	type post struct {
		id, op uint64
	}

	// Retrieve matching posts
	ips = make(map[string]bool, len(ids))
	posts := make([]post, 0, len(ids))
	for _, id := range ids {
		ip, err := GetIP(id, board)
		switch err {
		case nil:
		case sql.ErrNoRows:
			continue
		default:
			return nil, err
		}
		ips[ip] = true
		posts = append(posts, post{id: id})
	}

	// Retrieve their OPs
	for i, post := range posts {
		post.op, err = GetPostOP(post.id)
		if err != nil {
			return
		}
		posts[i] = post
	}

	// Write ban messages to posts
	for _, post := range posts {
		var msg []byte
		msg, err = common.EncodeMessage(common.MessageBanned, post.id)
		if err != nil {
			return
		}
		err = execPrepared("ban_post", post.id, post.op, msg)
		if err != nil {
			return
		}
	}

	// Write bans to the ban table
	for ip := range ips {
		err = execPrepared("write_ban", ip, board, reason, by, expires)
		if err != nil {
			return
		}
	}

	if len(ips) != 0 {
		_, err = db.Exec(`notify bans_updated`)
	}
	return
}

func loadBans() error {
	if err := updateBans(); err != nil {
		return err
	}
	return listenFunc("bans_updated", func(_ string) error {
		return updateBans()
	})
}

func updateBans() (err error) {
	r, err := db.Query(`SELECT ip, board FROM bans`)
	if err != nil {
		return
	}
	defer r.Close()

	bans := make([]auth.Ban, 0, 16)
	for r.Next() {
		var b auth.Ban
		err = r.Scan(&b.IP, &b.Board)
		if err != nil {
			return
		}
		bans = append(bans, b)
	}
	err = r.Err()
	if err != nil {
		return
	}
	auth.SetBans(bans...)

	return nil
}

// GetOwnedBoards returns boards the account holder owns
func GetOwnedBoards(account string) (boards []string, err error) {
	r, err := prepared["get_owned_boards"].Query(account)
	if err != nil {
		return
	}
	for r.Next() {
		var board string
		err = r.Scan(&board)
		if err != nil {
			return
		}
		boards = append(boards, board)
	}
	err = r.Err()
	return
}

// GetBanInfo retrieves information about a specific ban
func GetBanInfo(ip, board string) (b auth.BanRecord, err error) {
	err = prepared["get_ban_info"].
		QueryRow(ip, board).
		Scan(&b.Board, &b.IP, &b.By, &b.Reason, &b.Expires)
	return
}

// GetIP returns an IP of the poster that created a post. Posts older than 7
// days will not have this information.
func GetIP(id uint64, board string) (string, error) {
	var ip sql.NullString
	err := prepared["get_ip"].QueryRow(id, board).Scan(&ip)
	return ip.String, err
}