import { Page } from "./Page";
import { Manga } from "./Manga";

export interface Chapter {
  id: number;
  number: number;
  name: string;
  thumb: string;
  pages: Page[];
  manga: Manga;
}
