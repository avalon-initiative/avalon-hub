/** First 8 and last 4 characters of an id with an ellipsis; short strings are returned unchanged. */
export function shortId(id: string): string {
  return id.length <= 16 ? id : `${id.slice(0, 8)}…${id.slice(-4)}`
}
