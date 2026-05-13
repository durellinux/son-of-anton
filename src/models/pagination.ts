export interface Paged<T> {
  items: T[];
  nextCursor?: string;
}
