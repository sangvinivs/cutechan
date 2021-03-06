package templates

import (
	"html"
	"strings"
	"time"

	"github.com/cutechan/cutechan/go/auth"
	"github.com/cutechan/cutechan/go/common"
)

func posClasses(pos auth.Positions) string {
	var classes []string
	// Any next moderation level can do anything that previous can.
	// Add them all for simpler handling in CSS.
	for level := pos.CurBoard; level >= auth.Moderator; level-- {
		classes = append(classes, "pos_"+level.String())
	}
	for level := pos.AnyBoard; level >= auth.Moderator; level-- {
		classes = append(classes, "anypos_"+level.String())
	}
	if pos.AnyBoard > auth.NotLoggedIn {
		classes = append(classes, "user")
	}
	if pos.IsPowerUser() {
		classes = append(classes, "user_power")
	}
	return strings.Join(classes, " ")
}

// https://example.com/path -> //example.com
// https://example.com -> //example.com
// //example.com/path -> //example.com
func getDNSPrefetchURL(url string) string {
	colon := strings.IndexByte(url, ':')
	if colon > 0 {
		url = url[colon+1:]
	}
	slash := strings.IndexByte(url[2:], '/')
	if slash > 0 {
		url = url[:slash+2]
	}
	return url
}

// Extract reverse links to linked posts on a page
func extractBacklinks(cap int, threads ...common.Thread) common.Backlinks {
	bls := make(common.Backlinks, cap)
	register := func(p *common.Post, op uint64) {
		for _, l := range p.Links {
			m, ok := bls[l[0]]
			if !ok {
				m = make(map[uint64]uint64, 4)
				bls[l[0]] = m
			}
			m[p.ID] = op
		}
	}

	for _, t := range threads {
		register(t.Post, t.ID)
		for _, p := range t.Posts {
			register(p, t.ID)
		}
	}

	return bls
}

// CalculateOmit returns the omitted post and image counts for a thread
func CalculateOmit(t common.Thread) (int, int) {
	// There might still be posts missing due to deletions even in complete
	// thread queries. Ensure we are actually retrieving an abbreviated thread
	// before calculating.
	if !t.Abbrev {
		return 0, 0
	}

	omit := int(t.PostCtr) - (len(t.Posts) + 1)
	imgOmit := 0
	if omit != 0 {
		imgOmit = int(t.ImageCtr) - len(t.Files)
		for _, p := range t.Posts {
			imgOmit -= len(p.Files)
		}
	}
	return omit, imgOmit
}

func bold(s string) string {
	s = html.EscapeString(s)
	b := make([]byte, 3, len(s)+7)
	copy(b, "<b>")
	b = append(b, s...)
	b = append(b, "</b>"...)
	return string(b)
}

// Manually correct time zone, because it gets stored wrong in the database
// somehow.
func correctTimeZone(t time.Time) time.Time {
	t = t.Round(time.Second)
	return time.Date(
		t.Year(),
		t.Month(),
		t.Day(),
		t.Hour(),
		t.Minute(),
		t.Second(),
		0,
		time.Local,
	).UTC()
}

// https://stackoverflow.com/a/38608022
type sortableUInt64 []uint64

func (a sortableUInt64) Len() int           { return len(a) }
func (a sortableUInt64) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a sortableUInt64) Less(i, j int) bool { return a[i] < a[j] }
