import { Discord, Command, CommandMessage, On, ArgsOf, Rule } from '@typeit/discord';
import { LittleGarden } from "../modules/LittleGarden";
import { MessageEmbed, MessageEmbedImage, User, Client, Message } from 'discord.js';
import { ReadingSession } from '../modules/LittleGarden/classes/ReadingSession';

@Discord(Rule("-lg").space())
export abstract class LittleGardenBot {
  @Command("mangas")
  async mangas(command: CommandMessage) {
    const mangas = await LittleGarden.instance.getMangas();
    if (mangas.length > 0) {
      const message = new MessageEmbed();

      message.setTitle("Les mangas disponibles");
      message.setThumbnail(LittleGarden.join("logo.png"));
      message.setURL(LittleGarden.join("/"));
      LittleGarden.signMessage(message);

      mangas.map((manga) => {
        message.addField(manga.name, manga.slug);
      });

      command.reply(message);
    } else {
      command.reply("Aucuns mangas disponibles 😢");
    }
  }

  @Command("chapitres")
  async chapters(command: CommandMessage) {
    const [,, slug] = command.args;
    if (slug) {
      const chapters = await LittleGarden.instance.getChapters(slug);
      
      if (chapters.length > 0) {
        const message = new MessageEmbed();

        message.setURL(LittleGarden.join(slug));
        message.setTitle(`Les derniers chapitres de ${chapters[0].manga.name}`);
        message.setThumbnail(LittleGarden.getImage(chapters[0].manga.thumb));
        LittleGarden.signMessage(message);
  
        chapters.map((chapter) => {
          message.addField(chapter.manga.name, chapter.number);
        });
  
        command.reply(message);
      } else {
        command.reply(`Aucun chapitre disponible pour: **${slug}**`)
      }
    } else {
      command.reply("Tu dois fournir un nom de manga")
    }
  }

  @Command("lire")
  async read(command: CommandMessage) {
    const [,, slug, strNumber, page, shared] = command.args;
    if (slug && strNumber) {
      const number = Number(strNumber);
      const chapter = await LittleGarden.instance.getChapter(slug, Number(number));
      const sharedKeywords = ["partage", "partagé", "p", "oui"];
      const isNotPage = sharedKeywords.includes(page);
      const isShared = sharedKeywords.includes(shared) || isNotPage;

      if (chapter.id) {
        this.deleteCoolDown(command);

        await ReadingSession.create(
          command.author,
          command,
          chapter,
          isNotPage ? 0 : page ? Number(page) - 1 : 0,
          isShared
        );
      } else {
        command.reply(`Le chapitre ${slug} ${strNumber} n'existe pas 😢`);
      }
    } else {
      command.reply("Tu dois fournir un nom de manga et un numéro de chapitre");
    }
  }

  @On("messageReactionAdd")
  async onReact([messageReaction, user]: ArgsOf<"messageReactionAdd">, client: Client) { 
    if (user.id !== client.user.id) {
      messageReaction.message.reactions.resolve(messageReaction.emoji.name).users.remove(user.id)
    }

    const reading = ReadingSession.getReading(messageReaction.message);
    if (reading) {
      const pass = reading.shared || reading.user.id === user.id;
      if (pass) {
        switch(messageReaction.emoji.name) {
          case "👉":
            return reading.next();
          case "👈":
            return reading.prev();
          case "❌":
            return reading.stop();
          case "👨‍👨‍👦":
            return reading.setShared(true);
          case "🙍‍♂️‍":
            return reading.setShared(false);
        }
      }
    }
  }

  private deleteCoolDown(message: Message | CommandMessage, time: number = 1000 * 10) {
    return new Promise((resolve) => {
      setTimeout(async () => {
        await message.delete();
        resolve();
      }, time);
    });
  }
}
