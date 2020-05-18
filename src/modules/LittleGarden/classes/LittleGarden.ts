import * as fetch from "node-fetch"
import ApolloClient, { InMemoryCache, gql } from "apollo-boost";
import { Manga } from "../types/Manga";
import { Chapter } from '../types/Chapter';
import * as URL from "url";
import { MessageEmbed } from 'discord.js';

export class LittleGarden {
  private static _instance: LittleGarden;
  static readonly serverUrl = "https://littlexgarden.com";
  private _client: ApolloClient<InMemoryCache>;
  private _limit = 5;

  static get instance() {
    if (!this._instance) {
      this._instance = new LittleGarden();
    }
    return this._instance;
  }

  constructor() {
    this._client = new ApolloClient({
      uri: LittleGarden.join("graphql"),
      fetch
    });
  }

  static join(...path: string[]) {
    return URL.resolve(LittleGarden.serverUrl, path.join("/"));
  }

  static getImage(image: string) {
    return LittleGarden.join("static", "images", image);
  }

  async getMangas(): Promise<Manga[]> {
    const res = await this._client.query({
      query: gql`
        query mangas {
          mangas(
            where: {
              deleted: false,
              published: true
            }
          ) {
            id
            slug
            name
            thumb
          }
        }
      `
    });

    return res.data.mangas;
  }

  async getChapters(slug: string, page: number = 0): Promise<Chapter[]> {
    const res = await this._client.query({
      query: gql`
        query chapters($slug: String!, $skip: Float!, $limit: Float!) {
          chapters(
            where: {
              deleted: false,
              published: true,
              manga: {
                slug: $slug,
                deleted: false,
                published: true
              }
            },
            limit: $limit,
            skip: $skip,
            order: [{ field: "number", order: -1 }]
          ) {
            id
            number
            thumb
            manga {
              id
              name
              slug
              thumb
            }
            pages {
              colored
              original
            }
          }
        }
      `,
      variables: {
        slug,
        limit: this._limit,
        skip: this._limit * page
      }
    });

    return res.data.chapters;
  }

  async getChapter(slug: string, number: number): Promise<Chapter> {
    const res = await this._client.query({
      query: gql`
        query chapter($slug: String!, $number: Float!) {
          chapter(
            where: {
              number: $number,
              deleted: false,
              published: true,
              manga: {
                slug: $slug,
                deleted: false,
                published: true
              }
            }
          ) {
            id
            number
            thumb
            manga {
              id
              name
              slug
            }
            pages {
              colored
              original
            }
          }
        }
      `,
      variables: {
        slug,
        number
      }
    });

    return res.data.chapter;
  }

  static signMessage(message: MessageEmbed) {
    message.setFooter("Par Little Garden", LittleGarden.join("logo.png"));
  }
}
