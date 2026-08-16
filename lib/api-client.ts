/**
 * API レスポンスを JSON として読む。平文（413 等）も日本語エラーに変換する。
 */
export async function readApiJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    if (res.status === 413 || /request entity too large/i.test(text)) {
      throw new Error(
        "画像が大きすぎます。別の写真で試すか、枚数を減らしてください。"
      );
    }
    const snippet = text.trim().slice(0, 120);
    throw new Error(snippet || "サーバーエラーが発生しました");
  }

  if (!res.ok) {
    const err = data as { error?: string };
    throw new Error(err.error || "リクエストに失敗しました");
  }

  return data as T;
}
