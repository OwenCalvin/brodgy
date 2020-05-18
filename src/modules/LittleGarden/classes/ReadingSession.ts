import { Chapter } from '../types/Chapter';
import { MessageEmbed, User, Message } from 'discord.js';
import { LittleGarden } from '..';

export class ReadingSession {
  private static _readingSessions: Map<User, ReadingSession> = new Map<User, ReadingSession>();
  
  private _user: User;
  private _chapter: Chapter;
  private _page: number;
  private _message: MessageEmbed;
  private _sentMessage: Message;
  private _commandMessage: Message;
  private _autoStop: NodeJS.Timeout;
  private _shared: boolean;

  get user() {
    return this._user;
  }

  get page() {
    return this._page;
  }

  get chapter() {
    return this._chapter;
  }

  get message() {
    return this._message;
  }

  get shared() {
    return this._shared;
  }

  get title() {
    return `${this._chapter.manga.name} ${this._chapter.number} - ${this._page + 1}`;
  }

  get sharedText() {
    return this._user.tag + (this._shared ? " - Lecture partagée" : "");
  }

  private constructor(user: User, commandMessage: Message, shared: boolean) {
    this._user = user;
    this._message = new MessageEmbed();
    this._commandMessage = commandMessage;
    this._page = 0;
    this._shared = shared;
  }

  static async create(
    user: User,
    commandMessage: Message,
    chapter: Chapter,
    page: number = 0,
    shared: boolean = false
  ) {
    const rs = new ReadingSession(user, commandMessage, shared);

    rs.stop();

    ReadingSession.update(rs, {
      chapter,
      page,
      shared
    });

    rs._message.setTitle(rs.title);
    rs._message.addField("Lecteur", rs.sharedText);
    LittleGarden.signMessage(rs._message);
    rs._message.thumbnail = {
      url: LittleGarden.getImage(rs._chapter.thumb)
    };

    rs._sentMessage = await rs._commandMessage.channel.send(rs._message);

    return await rs.setPage(page);
  }

  static update(
    readingSession: ReadingSession,
    params: Partial<ReadingSession>
  ) {
    readingSession._chapter = params.chapter || readingSession._chapter;
    readingSession._page = params.page !== undefined ? params.page : readingSession._page;
    readingSession._shared = params.shared !== undefined ? params.shared : readingSession._shared;

    this._readingSessions.set(readingSession._user, readingSession);

    return readingSession;
  }

  static getReading(user: User);
  static getReading(message: Message);
  static getReading(userOrMessage: User | Message) {
    if (userOrMessage instanceof User) {
      return ReadingSession._readingSessions.get(userOrMessage);
    } else {
      return Array.from(ReadingSession._readingSessions.values()).find((rs) => {
        return rs._sentMessage.id === userOrMessage.id;
      });
    }
  }

  canPrev(page?: number) {
    const pageToTest = page !== undefined ? page : this.page;
    return pageToTest >= 0;
  }

  canNext(page?: number) {
    const pageToTest = page !== undefined ? page : this.page;
    return pageToTest < this._chapter.pages.length;
  }

  async setPage(page: number) {
    if (!Number.isNaN(page)) {
      if (page < 0) {
        page = 0;
      } else if (page > this._chapter.pages.length - 1) {
        page = this._chapter.pages.length - 1
      }

      ReadingSession.update(this, { page });

      const image = this._chapter.pages[page].colored || this._chapter.pages[page].original;
  
      this._message.setTitle(this.title);
      this._message.setImage(LittleGarden.getImage(image));
      this._message.setURL(LittleGarden.join(this._chapter.manga.slug, this._chapter.number.toString(), (this._page + 1).toString()));
      this._sentMessage = await this._sentMessage.edit(this._message);

      await this.addReactions("👈", "👉", "❌");
      await this.updateSharedReaction();
  
      clearTimeout(this._autoStop);
      this._autoStop = setTimeout(() => {
        this.stop();
        this._user.send(`Ta lecture de ${this.title} a été stoppé car elle est inactive depuis un moment`);
      }, 5 * 60 * 1000);
    } else {
      this.stop();
      return undefined;
    }
    return this;
  }

  async setShared(shared: boolean) {
    this._shared = shared;
    this._message.fields.find((field) => field.name === "Lecteur").value = this.sharedText;
    await this._sentMessage.edit(this._message);
    return this.updateSharedReaction();
  }

  async updateSharedReaction() {
    if (this._shared) {
      await this.removeReaction("👨‍👨‍👦");
      return this._sentMessage.react("🙍‍♂️");
    } else {
      await this.removeReaction("🙍‍♂️");
      return this._sentMessage.react("👨‍👨‍👦");
    }
  }

  removeReaction(emoji: string) {
    const reaction = this._sentMessage.reactions.resolve(emoji);
    if (reaction) {
      return reaction.remove()
    }
  }

  addReaction(emoji: string) {
    return this._sentMessage.react(emoji);
  }

  addReactions(...emojis: string[]) {
    return Promise.all(emojis.map((emoji) => {
      return this.addReaction(emoji);
    }));
  }

  updateMessage() {
    return this._sentMessage.edit(this._message);
  }

  next() {
    return this.setPage(this.page + 1);
  }

  prev() {
    return this.setPage(this.page - 1);
  }

  stop() {
    const existing = ReadingSession._readingSessions.get(this._user);
    if (existing) {
      if (existing._sentMessage) {
        existing._sentMessage.delete();
      }
    }
    return ReadingSession._readingSessions.delete(this._user);
  }
}
