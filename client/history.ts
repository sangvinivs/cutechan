// Inter-page navigation with HTML5 history

import {on, isMatch} from './util'
import {read, page, displayLoading} from './state'
import loadPage from './page/load'
import {synchronise} from './connection'

// Bind event listener
export default () =>
	on(document, "click", handleClick, {
		selector: "a.history, a.history img",
	})

function handleClick(event: KeyboardEvent) {
	if (event.ctrlKey) {
		return
	}
	const href =
		((event.target as Element)
			.closest("a.history") as HTMLAnchorElement)
		.href
	navigate(href, event)
}

// Navigate to the target og the URL and load its data. NewPoint indicates, if
// a new history state should be pushed.
async function navigate(url: string, event: Event) {
	let nextState = read(url)

	// Does the link point to the same page as this one?
	if (isMatch(nextState, page)) {
		return
	}
	if (event) {
		event.preventDefault()
	}

	displayLoading(true)

	// Load asynchronously and concurently as fast as possible
	let renderPage: () => void
	const ready = new Promise<void>((resolve) =>
		renderPage = resolve)
	const pageLoader = loadPage(nextState, ready)

	page.replaceWith(nextState)
	renderPage()
	await pageLoader
	synchronise()

	if (event) {
		history.pushState(null, null, nextState.href)
	}
	displayLoading(false)
}

function alertError(err: Error) {
	displayLoading(false)
	alert(err)
}

// For back and forward history events
window.onpopstate = (event: any) =>
	navigate(event.target.location.href, null).catch(alertError)