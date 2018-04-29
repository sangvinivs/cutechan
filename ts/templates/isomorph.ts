/** Template structs, helper routines and context providers. */
// MUST BE KEPT IN SYNC WITH go/src/meguca/templates/isomorph.go!

import templates from "cc-templates";
import * as Mustache from "mustache";
import { bodyEmbeds, renderBody } from ".";
import { ImageData } from "../common";
import { _, days, months, ngettext } from "../lang";
import { Backlinks, Post, sourcePath, Thread, thumbPath } from "../posts";
import { mine } from "../state";
import { Dict, makeNode, pad } from "../util";

export class TemplateContext {
  private template: string;
  private ctx: Dict;

  constructor(name: string, ctx: Dict) {
    this.template = templates[name];
    this.ctx = ctx;
  }

  public render(): string {
    return Mustache.render(this.template, this.ctx);
  }

  public renderNode(): HTMLElement {
    return makeNode(this.render());
  }
}

export function makePostContext(
  t: Thread, p: Post, bls: Backlinks,
  index: boolean, all: boolean,
): TemplateContext {
  const ctx: Dict = {
    ID: p.id,
    TID: t.id,
    Index: index,
    OP: t.id === p.id,
    HasBoard: t.id === p.id && index && all,
    Board: p.board,
    Subject: p.subject,
    Badge: !!p.auth,
    Auth: _(p.auth),
    Name: p.userName,
    HasFiles: !!p.files,
    post: p,
    backlinks: bls,
  };

  ctx.PostClass = () => {
    const classes = ["post"];
    if (ctx.OP) {
      classes.push("post_op");
    }
    if (ctx.post.files) {
      classes.push("post_file");
      if (ctx.post.files.length > 1) {
        classes.push("post_files");
      }
    }
    for (const provider of Object.keys(bodyEmbeds)) {
      if (bodyEmbeds[provider].test(ctx.post.body)) {
        classes.push("post_embed");
        break;
      }
    }
    if (p.userID === "") {
      classes.push("post_by-anon");
    } else {
      const src = unescape(encodeURIComponent(p.userID));
      const id = btoa(src).replace(/=+$/, "");
      classes.push("post_by-" + id);
    }
    return classes.join(" ");
  };

  ctx.URL = () => {
    let url = "";
    if (!ctx.OP) {
      url = `#${ctx.ID}`;
    }
    if (ctx.Index) {
      url = `/${ctx.Board}/${ctx.TID}${url}`;
    }
    return url;
  };

  // NOOP because we need to re-render based on relativeTime setting.
  ctx.Time = "";

  ctx.Files = (p.files || []).map(renderFile);

  ctx.Body = renderBody(p);

  // NOOP because we will need to update already rendered posts so avoid
  // code duplication.
  ctx.Backlinks = "";

  return new TemplateContext("post", ctx);
}

function renderFile(img: ImageData): string {
  return new TemplateContext("post-file", {
    SHA1: img.SHA1,
    HasTitle: !!img.title,
    LCopy: _("clickToCopy"),
    Title: img.title,
    HasVideo: img.video,
    HasAudio: img.audio,
    HasLength: img.video || img.audio,
    Length: duration(img.length || 0),
    Record: img.audio && !img.video,
    Size: fileSize(img.size),
    Width: img.dims[0],
    Height: img.dims[1],
    TWidth: img.dims[2],
    THeight: img.dims[3],
    SourcePath: sourcePath(img.fileType, img.SHA1),
    ThumbPath: thumbPath(img.thumbType, img.SHA1),
  }).render();
}

// Renders classic absolute timestamp.
export function readableTime(time: number): string {
  const d = new Date(time * 1000);
  return `${pad(d.getDate())} ${_(months[d.getMonth()])} `
    + `${d.getFullYear()} (${_(days[d.getDay()])}) `
    + `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function duration(l: number): string {
  return pad(Math.floor(l / 60)) + ":" + pad(Math.floor(l % 60));
}

// Formats a human-readable representation of file size.
export function fileSize(size: number): string {
  if (size < 1024) {
    return size + _("b");
  } else if (size < 1024 * 1024) {
    return (size / 1024).toFixed(2) + _("kb");
  } else {
    return (size / 1024 / 1024).toFixed(2) + _("mb");
  }
}

// Render a link to other post.
export function renderPostLink(id: number, cross: boolean, index: boolean): string {
  const url = `${(cross || index) ? `/all/${id}` : ""}#${id}`;
  return new TemplateContext("post-link", {
    Cross: cross,
    ID: id,
    LYou: _("you"),
    Mine: mine.has(id),
    URL: url,
  }).render();
}

// Renders readable elapsed time since post. Numbers are in seconds.
export function relativeTime(then: number): string {
  const now = Math.floor(Date.now() / 1000);
  let time = Math.floor((now - then) / 60);
  let isFuture = false;
  if (time < 1) {
    if (time > -5) { // Assume to be client clock imprecision
      return _("justNow");
    } else {
      isFuture = true;
      time = -time;
    }
  }

  const divide = [60, 24, 30, 12];
  const unit = ["minute", "hour", "day", "month"];
  for (let i = 0; i < divide.length; i++) {
    if (time < divide[i]) {
      return ago(unit[i], time, isFuture);
    }
    time = Math.floor(time / divide[i]);
  }

  return ago("year", time, isFuture);
}

// Renders "56 minutes ago" or "in 56 minutes" like relative time text.
function ago(unit: string, time: number, isFuture: boolean): string {
  const count = `${time} ${ngettext(unit, "", time)}`;
  return isFuture
    ? `${_("in")} ${count}`
    : `${count} ${_("ago")}`;
}
