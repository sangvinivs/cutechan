/**
 * Admin page UI.
 *
 * @module cutechan/admin
 */

import cx from "classnames";
import { Component, h, render } from "preact";
import { showSendAlert } from "../alerts";
import API from "../api";
import { ModerationLevel } from "../auth";
import _ from "../lang";
import { BoardConfig, page } from "../state";
import { readableTime, relativeTime } from "../templates";
import { replace } from "../util";
import { MAIN_CONTAINER_SEL } from "../vars";
import { MemberList } from "../widgets";

export const enum AccessMode {
  bypass = -1,
  viaBlacklist,
  viaWhitelist,
}

interface AdminBoardConfig extends BoardConfig {
  modOnly?: boolean;
  accessMode?: AccessMode;
  includeAnon?: boolean;
}

type ModBoards = AdminBoardConfig[];

interface StaffRecord {
  board: string;
  userID: string;
  position: ModerationLevel;
}

type Staff = StaffRecord[];

interface BanRecord {
  ip: string;
  board: string;
  id: number;
  by: string;
  expires: number;
  reason: string;
}

type BanRecords = BanRecord[];

const enum ModerationAction {
  banPost,
  unbanPost,
  deletePost,
  deleteImage,
  spoilerImage,
  deleteThread,
  updateBoard,
}

interface ModLogRecord {
  board: string;
  id: number;
  type: ModerationAction;
  by: string;
  created: number;
}

type ModLogRecords = ModLogRecord[];

declare global {
  interface Window {
    modBoards?: ModBoards;
    modStaff?: Staff;
    modBans?: BanRecords;
    modLog?: ModLogRecords;
  }
}

export const modBoards = window.modBoards;
export const modStaff = window.modStaff;
export const modBans = window.modBans;
export const modLog = window.modLog;

type ChangeFn = (changes: BoardStateChanges) => void;

interface SettingsProps {
  settings: AdminBoardConfig;
  disabled: boolean;
  onChange: ChangeFn;
}

class Settings extends Component<SettingsProps, {}> {
  public shouldComponentUpdate(nextProps: SettingsProps) {
    return (
      this.props.settings !== nextProps.settings ||
      this.props.disabled !== nextProps.disabled
    );
  }
  public render({ settings, disabled }: SettingsProps) {
    const { title, readOnly, modOnly, accessMode, includeAnon } = settings;
    return (
      <div class={cx("admin-settings", disabled && "admin-settings_disabled")}>
        <a class="admin-content-anchor" name="settings" />
        <h3 class="admin-content-header">
          <a class="admin-header-link" href="#settings">
            {_("Settings")}
          </a>
        </h3>
        <label class="admin-settings-label">
          <span class="admin-settings-text">{_("Title")}</span>
          <input
            class="admin-settings-input"
            value={title}
            disabled={disabled}
            onInput={this.handleTitleChange}
          />
        </label>
        <label class="admin-settings-label admin-settings-label_select">
          <span class="admin-settings-text">{_("Access mode")}</span>
          <select
            class="admin-settings-select"
            value={(accessMode || 0).toString()}
            disabled={disabled}
            onChange={this.handleAccessModeChange}
          >
            <option value={AccessMode.bypass.toString()}>{_("Bypass")}</option>
            <option value={AccessMode.viaBlacklist.toString()}>
              {_("Deny blacklisted")}
            </option>
            <option value={AccessMode.viaWhitelist.toString()}>
              {_("Allow whitelisted")}
            </option>
          </select>
        </label>
        <label class="admin-settings-label">
          <span class="admin-settings-text">{_("Including anonymous")}</span>
          <input
            class="admin-settings-checkbox"
            type="checkbox"
            checked={includeAnon}
            disabled={disabled}
            onChange={this.handleIncludeAnonToggle}
          />
        </label>
        <label class="admin-settings-label">
          <span class="admin-settings-text">{_("Read only")}</span>
          <input
            class="admin-settings-checkbox"
            type="checkbox"
            checked={readOnly}
            disabled={disabled}
            onChange={this.handleReadOnlyToggle}
          />
        </label>
        <label class="admin-settings-label">
          <span class="admin-settings-text">{_("Mod only")}</span>
          <input
            class="admin-settings-checkbox"
            type="checkbox"
            checked={modOnly}
            disabled={disabled}
            onChange={this.handleModOnlyToggle}
          />
        </label>
      </div>
    );
  }
  private handleTitleChange = (e: Event) => {
    const title = (e.target as HTMLInputElement).value;
    const settings = { ...this.props.settings, title };
    this.props.onChange({ settings });
  };
  private handleReadOnlyToggle = (e: Event) => {
    e.preventDefault();
    const readOnly = !this.props.settings.readOnly;
    const settings = { ...this.props.settings, readOnly };
    this.props.onChange({ settings });
  };
  private handleModOnlyToggle = (e: Event) => {
    e.preventDefault();
    const modOnly = !this.props.settings.modOnly;
    const settings = { ...this.props.settings, modOnly };
    this.props.onChange({ settings });
  };
  private handleAccessModeChange = (e: Event) => {
    const accessMode = +(e.target as HTMLInputElement).value;
    const settings = { ...this.props.settings, accessMode };
    this.props.onChange({ settings });
  };
  private handleIncludeAnonToggle = (e: Event) => {
    e.preventDefault();
    const includeAnon = !this.props.settings.includeAnon;
    const settings = { ...this.props.settings, includeAnon };
    this.props.onChange({ settings });
  };
}

interface MembersProps {
  board: string;
  staff: Staff;
  disabled: boolean;
  onChange: ChangeFn;
}

class Members extends Component<MembersProps, {}> {
  public shouldComponentUpdate(nextProps: MembersProps) {
    return (
      this.props.staff !== nextProps.staff ||
      this.props.disabled !== nextProps.disabled
    );
  }
  public render({ disabled }: MembersProps) {
    return (
      <div class="admin-members">
        <a class="admin-content-anchor" name="members" />
        <h3 class="admin-content-header">
          <a class="admin-header-link" href="#members">
            {_("Members")}
          </a>
        </h3>
        <div class="admin-members-grid">
          <div class="admin-owners">
            <h3 class="admin-members-shead">{_("Owners")}</h3>
            <MemberList
              members={this.getStaff(ModerationLevel.boardOwner)}
              disabled={disabled}
              onChange={this.handleOwnersChange}
            />
          </div>
          <div class="admin-moderators">
            <h3 class="admin-members-shead">{_("Moderators")}</h3>
            <MemberList
              members={this.getStaff(ModerationLevel.moderator)}
              disabled={disabled}
              onChange={this.handleModeratorsChange}
            />
          </div>
          <div class="admin-janitors">
            <h3 class="admin-members-shead">{_("Janitors")}</h3>
            <MemberList
              members={this.getStaff(ModerationLevel.janitor)}
              disabled={disabled}
              onChange={this.handleJanitorsChange}
            />
          </div>
          <div class="admin-whitelist">
            <h3 class="admin-members-shead">{_("Whitelist")}</h3>
            <MemberList
              members={this.getStaff(ModerationLevel.whitelisted)}
              disabled={disabled}
              onChange={this.handleWhitelistChange}
            />
          </div>
          <div class="admin-blacklist">
            <h3 class="admin-members-shead">{_("Blacklist")}</h3>
            <MemberList
              members={this.getStaff(ModerationLevel.blacklisted)}
              disabled={disabled}
              onChange={this.handleBlacklistChange}
            />
          </div>
        </div>
      </div>
    );
  }
  private getStaff(position: ModerationLevel) {
    return this.props.staff
      .filter((s) => s.position === position)
      .map((s) => s.userID);
  }
  private setStaff(position: ModerationLevel, names: string[]) {
    const board = this.props.board;
    const staff = this.props.staff.filter((s) => s.position !== position);
    const newStaff = names.map((userID) => ({ board, userID, position }));
    return staff.concat(newStaff);
  }
  private handleOwnersChange = (owners: string[]) => {
    const staff = this.setStaff(ModerationLevel.boardOwner, owners);
    this.props.onChange({ staff });
  };
  private handleModeratorsChange = (moderators: string[]) => {
    const staff = this.setStaff(ModerationLevel.moderator, moderators);
    this.props.onChange({ staff });
  };
  private handleJanitorsChange = (janitors: string[]) => {
    const staff = this.setStaff(ModerationLevel.janitor, janitors);
    this.props.onChange({ staff });
  };
  private handleWhitelistChange = (whitelist: string[]) => {
    const staff = this.setStaff(ModerationLevel.whitelisted, whitelist);
    this.props.onChange({ staff });
  };
  private handleBlacklistChange = (blacklist: string[]) => {
    const staff = this.setStaff(ModerationLevel.blacklisted, blacklist);
    this.props.onChange({ staff });
  };
}

interface BansProps {
  bans: BanRecords;
  disabled: boolean;
  onChange: ChangeFn;
}

class Bans extends Component<BansProps, {}> {
  public shouldComponentUpdate(nextProps: BansProps) {
    return (
      this.props.bans !== nextProps.bans ||
      this.props.disabled !== nextProps.disabled
    );
  }
  public render({ bans, disabled }: BansProps) {
    return (
      <div class={cx("admin-bans", disabled && "admin-bans_disabled")}>
        <a class="admin-content-anchor" name="bans" />
        <h3 class="admin-content-header">
          <a class="admin-header-link" href="#bans">
            {_("Bans")}
          </a>
        </h3>
        <table class="admin-table admin-ban-list">
          <thead>
            <tr class="admin-table-header admin-ban-item-header">
              <th class="admin-ban-id-header">#</th>
              <th class="admin-ban-reason-header">{_("Reason")}</th>
              <th class="admin-ban-by-header">{_("By")}</th>
              <th class="admin-ban-time-header">{_("Expires")}</th>
            </tr>
          </thead>
          <tbody>
            {bans.map(({ id, reason, by, expires }) => (
              <tr
                class="admin-table-item admin-ban-item"
                onClick={() => this.handleRemove(id)}
              >
                <td class="admin-ban-id">
                  <a class="post-link" href={`/all/${id}#${id}`}>
                    &gt;&gt;{id}
                  </a>
                </td>
                <td class="admin-ban-reason">{reason}</td>
                <td class="admin-ban-by">{by}</td>
                <td class="admin-ban-time" title={readableTime(expires)}>
                  {relativeTime(expires)}
                </td>
              </tr>
            ))}
            {!bans.length && (
              <tr class="admin-table-empty">
                <td class="admin-bans-empty" colSpan={4}>
                  {_("No bans")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }
  private handleRemove(id: number) {
    if (this.props.disabled) return;
    const bans = this.props.bans.filter((b) => b.id !== id);
    this.props.onChange({ bans });
  }
}

interface LogProps {
  board: string;
}

class Log extends Component<LogProps, {}> {
  public shouldComponentUpdate(nextProps: LogProps) {
    return this.props.board !== nextProps.board;
  }
  public render({ board }: LogProps) {
    const log = modLog.filter((l) => l.board === board);
    return (
      <div class="admin-log">
        <a class="admin-content-anchor" name="log" />
        <h3 class="admin-content-header">
          <a class="admin-header-link" href="#log">
            {_("Mod log")}
          </a>
        </h3>
        <table class="admin-table admin-log-list">
          <thead>
            <tr class="admin-table-header admin-log-item-header">
              <th class="admin-log-id-header">#</th>
              <th class="admin-log-type-header">{_("Type")}</th>
              <th class="admin-log-by-header">{_("By")}</th>
              <th class="admin-log-time-header">{_("Date")}</th>
            </tr>
          </thead>
          <tbody>
            {log.map(({ id, type, by, created }) => (
              <tr class="admin-table-item admin-log-item">
                <td class="admin-log-id">{this.renderLink(id, type)}</td>
                <td class="admin-log-type">{this.renderType(type)}</td>
                <td class="admin-log-by">{by}</td>
                <td class="admin-log-time" title={readableTime(created)}>
                  {relativeTime(created)}
                </td>
              </tr>
            ))}
            {!log.length && (
              <tr class="admin-table-empty admin-log-item">
                <td class="admin-log-empty" colSpan={4}>
                  {_("Empty log")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }
  private renderLink(id: number, a: ModerationAction) {
    switch (a) {
      case ModerationAction.updateBoard:
        return (
          <a class="post-link" href={`/${this.props.board}/`}>
            /{this.props.board}/
          </a>
        );
      default:
        return (
          <a class="post-link" href={`/all/${id}#${id}`}>
            &gt;&gt;{id}
          </a>
        );
    }
  }
  private renderType(a: ModerationAction) {
    switch (a) {
      case ModerationAction.banPost:
        return <i class="fa fa-gavel" title={_("ban")} />;
      case ModerationAction.unbanPost:
        return (
          <span class="fa-stack" title={_("unban")}>
            <i class="fa fa-gavel fa-stack-1x" />
            <i class="fa fa-ban fa-stack-2x admin-log-ban-icon" />
          </span>
        );
      case ModerationAction.deletePost:
        return <i class="fa fa-trash" title={_("deletePost")} />;
      case ModerationAction.deleteImage:
        return null;
      case ModerationAction.spoilerImage:
        return null;
      case ModerationAction.deleteThread:
        return <i class="fa fa-2x fa-trash-o" title={_("deleteThread")} />;
      case ModerationAction.updateBoard:
        return <i class="fa fa-refresh" title={_("updateBoard")} />;
    }
  }
}

interface BoardState {
  settings: AdminBoardConfig;
  staff: Staff;
  bans: BanRecords;
}

interface BoardStateChanges {
  settings?: AdminBoardConfig;
  staff?: Staff;
  bans?: BanRecords;
}

interface AdminState {
  id: string;
  boardState: BoardState;
  needSaving: boolean;
  saving: boolean;
}

class Admin extends Component<{}, AdminState> {
  constructor() {
    super();
    let id = page.admin;
    if (!modBoards.some((b) => b.id === id)) {
      // If user doesn't own board provided in URL, just use another.
      // User with access to admin page will have at least one.
      id = modBoards[0].id;
    }
    this.fixateBoardInURL(id);
    this.state = {
      id,
      boardState: this.getBoardState(id),
      needSaving: false,
      saving: false,
    };
  }
  public render({}, { id, boardState, needSaving, saving }: AdminState) {
    const { settings, staff, bans } = boardState;
    return (
      <section class="admin">
        <header class="admin-header">
          <h1 class="page-title">
            <span class="admin-header-text">{_("Admin")}</span>
            <select
              class="admin-board-select"
              value={boardState.settings.id}
              onChange={this.handleBoardChange}
            >
              {modBoards.map((b) => (
                <option value={b.id}>/{b.id}/</option>
              ))}
            </select>
          </h1>
        </header>
        <section class="admin-inner">
          <ul class="admin-section-tabs">
            <li class="admin-section-tab">
              <a href="#settings">{_("Settings")}</a>
            </li>
            <li class="admin-section-tab">
              <a href="#members">{_("Members")}</a>
            </li>
            <li class="admin-section-tab">
              <a href="#bans">{_("Bans")}</a>
            </li>
            <li class="admin-section-tab">
              <a href="#log">{_("Mod log")}</a>
            </li>
          </ul>
          <hr class="admin-separator" />
          <section class="admin-content">
            <Settings
              settings={settings}
              disabled={saving}
              onChange={this.handleChange}
            />
            <hr class="admin-separator" />
            <Members
              board={id}
              staff={staff}
              disabled={saving}
              onChange={this.handleChange}
            />
            <hr class="admin-separator" />
            <Bans bans={bans} disabled={saving} onChange={this.handleChange} />
            <hr class="admin-separator" />
            <Log board={id} />
          </section>
        </section>
        <footer
          class={cx("admin-footer", needSaving && "admin-footer_visible")}
        >
          <button
            class="button admin-button admin-save-button"
            disabled={saving}
            onClick={this.handleSave}
          >
            <i
              class={cx("admin-icon admin-save-icon fa", {
                "fa-spinner fa-pulse fa-fw": saving,
                "fa-check-circle": !saving,
              })}
            />
            {_("Save")}
          </button>
          <button
            class="button admin-button admin-cancel-button"
            disabled={saving}
            onClick={this.handleReset}
          >
            <i class="admin-icon admin-reset-icon fa fa-times-circle" />
            {_("Reset")}
          </button>
        </footer>
      </section>
    );
  }
  private fixateBoardInURL(id: string) {
    history.pushState({}, "", `/admin/${id}`);
  }
  private getBoardState(id: string) {
    const board = modBoards.find((b) => b.id === id);
    return {
      settings: { ...board },
      staff: modStaff.filter((b) => b.board === id),
      bans: modBans.filter((b) => b.board === id),
    };
  }
  private fixateBoardState() {
    const id = this.state.id;
    const s = this.state.boardState;

    const board = modBoards.find((b) => b.id === id);
    Object.assign(board, s.settings);

    const staff = modStaff.filter((b) => b.board !== id);
    staff.push(...s.staff);
    replace(modStaff, staff);

    const bans = modBans.filter((b) => b.board !== id);
    bans.push(...s.bans);
    replace(modBans, bans);
  }
  private handleBoardChange = (e: Event) => {
    const id = (e.target as HTMLInputElement).value;
    this.fixateBoardInURL(id);
    const boardState = this.getBoardState(id);
    this.setState({ id, boardState });
  };
  private handleChange = (changes: BoardStateChanges) => {
    const boardState = Object.assign({}, this.state.boardState, changes);
    this.setState({ boardState, needSaving: true });
  };
  private handleSave = () => {
    const id = this.state.id;
    const oldState = this.getBoardState(id);
    const newState = this.state.boardState;
    this.setState({ saving: true });
    API.board
      .save(id, { oldState, newState })
      .then(() => {
        this.fixateBoardState();
        this.setState({ needSaving: false });
      }, showSendAlert)
      .then(() => {
        this.setState({ saving: false });
      });
  };
  private handleReset = () => {
    const boardState = this.getBoardState(this.state.id);
    this.setState({ boardState, needSaving: false });
  };
}

export function init() {
  const container = document.querySelector(MAIN_CONTAINER_SEL);
  if (container) {
    render(<Admin />, container);
  }
}
