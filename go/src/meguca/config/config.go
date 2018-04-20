// Package config stores and exports the configuration for server-side use and
// the public availability JSON struct, which includes a small subset of the
// server configuration.
package config

import (
	"meguca/common"
	"reflect"
	"sort"
	"sync"

	"github.com/mailru/easyjson"
)

var (
	// Ensures no reads happen, while the configuration is reloading
	globalMu, boardMu sync.RWMutex

	// Contains currently loaded global server configuration
	global *Configs

	// Map of board IDs to their configuration structs
	boardConfigs = map[string]BoardConfContainer{}

	// AllBoardConfigs stores board-specific configurations for the /all/
	// metaboard. Constant.
	AllBoardConfigs = BoardConfContainer{
		BoardConfigs: BoardConfigs{
			ID: "all",
		},
	}

	// JSON of client-accessible configuration
	clientJSON []byte

	// Defaults contains the default server configuration values
	Defaults = Configs{
		Public: Public{
			DisableUserBoards: true,
			MaxSize:           common.DefaultMaxSize,
			MaxFiles:          common.DefaultMaxFiles,
			DefaultLang:       common.DefaultLang,
			DefaultCSS:        common.DefaultCSS,
		},
	}
)

// Generate /all/ board configs
func init() {
	var err error
	AllBoardConfigs.JSON, err = easyjson.Marshal(AllBoardConfigs.BoardPublic)
	if err != nil {
		panic(err)
	}
}

// Get returns a pointer to the current server configuration struct. Callers
// should not modify this struct.
func Get() *Configs {
	globalMu.RLock()
	defer globalMu.RUnlock()
	return global
}

// Set sets the internal configuration struct
func Set(c Configs) error {
	client, err := easyjson.Marshal(c.Public)
	if err != nil {
		return err
	}
	globalMu.Lock()
	clientJSON = client
	global = &c
	globalMu.Unlock()

	return nil
}

// GetClient returns public availability configuration JSON.
func GetClient() []byte {
	return clientJSON
}

// GetBoardConfigs returns board-specific configurations for a board combined
// with pregenerated public JSON of these configurations. Do not modify
// the retrieved struct.
func GetBoardConfigs(b string) BoardConfContainer {
	if b == "all" {
		return AllBoardConfigs
	}
	boardMu.RLock()
	defer boardMu.RUnlock()
	return boardConfigs[b]
}

// GetAllBoardConfigs returns board-specific configurations for all boards. Do
// not modify the retrieved structs.
func GetAllBoardConfigs() []BoardConfContainer {
	boardMu.RLock()
	defer boardMu.RUnlock()

	conf := make([]BoardConfContainer, 0, len(boardConfigs))
	for _, c := range boardConfigs {
		conf = append(conf, c)
	}
	return conf
}

// GetBoardTitles returns a slice of all existing boards and their titles
func GetBoardTitles() BoardTitles {
	boardMu.RLock()
	defer boardMu.RUnlock()

	bt := make(BoardTitles, 0, len(boardConfigs))
	for id, conf := range boardConfigs {
		if conf.ModOnly {
			continue
		}
		bt = append(bt, BoardTitle{
			ID:    id,
			Title: conf.Title,
		})
	}

	sort.Sort(bt)
	return bt
}

func GetBoardTitlesByList(boards []string) BoardTitles {
	boardMu.RLock()
	defer boardMu.RUnlock()

	bt := make(BoardTitles, 0, len(boards))
	for _, id := range boards {
		conf, ok := boardConfigs[id]
		if ok {
			bt = append(bt, BoardTitle{
				ID:    id,
				Title: conf.Title,
			})
		}
	}

	sort.Sort(bt)
	return bt
}

// GetBoards returns an array of currently existing boards
func GetBoards() []string {
	boardMu.RLock()
	defer boardMu.RUnlock()
	boards := make([]string, 0, len(boardConfigs))
	for b := range boardConfigs {
		boards = append(boards, b)
	}
	sort.Strings(boards)
	return boards
}

// IsBoard returns whether the passed string is a currently existing board
func IsBoard(b string) bool {
	boardMu.RLock()
	defer boardMu.RUnlock()
	_, ok := boardConfigs[b]
	return ok
}

func IsServeBoard(b string) bool {
	return b == "all" || IsBoard(b)
}

func IsReadOnlyBoard(b string) bool {
	boardMu.RLock()
	defer boardMu.RUnlock()
	conf, ok := boardConfigs[b]
	return ok && conf.ReadOnly
}

func IsModOnlyBoard(b string) bool {
	boardMu.RLock()
	defer boardMu.RUnlock()
	conf, ok := boardConfigs[b]
	return ok && conf.ModOnly
}

// SetBoardConfigs sets configurations for a specific board as well as
// pregenerates their public JSON. Returns if any changes were made to
// the configs in result.
func SetBoardConfigs(conf BoardConfigs) (bool, error) {
	cont := BoardConfContainer{
		BoardConfigs: conf,
	}
	var err error
	cont.JSON, err = easyjson.Marshal(conf.BoardPublic)
	if err != nil {
		return false, err
	}

	boardMu.Lock()
	defer boardMu.Unlock()

	// Nothing changed
	noChange := reflect.DeepEqual(
		boardConfigs[conf.ID].BoardConfigs,
		cont.BoardConfigs,
	)
	if noChange {
		return false, nil
	}

	// Swap config
	boardConfigs[conf.ID] = cont
	return true, nil
}

// RemoveBoard removes a board from the exiting board list and deletes its
// configurations. To be called, when a board is deleted.
func RemoveBoard(b string) {
	boardMu.Lock()
	defer boardMu.Unlock()
	delete(boardConfigs, b)
}
