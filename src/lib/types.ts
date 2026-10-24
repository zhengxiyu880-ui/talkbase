/** 一次录音/一场会议的全部数据。 */
export type Segment = {
  /** 段序号，0 开始 */
  i: number;
  /** 起始时间（秒） */
  t: number;
  /** 识别出的文字 */
  text: string;
};

export type Session = {
  id: string;
  title: string;
  /** ISO 时间 */
  createdAt: string;
  /** 时长（秒） */
  durationSec: number;
  source: "paste" | "audio" | "demo";
  segments: Segment[];
  /** AI 生成的会议总结，未生成时为空 */
  summary?: string;
  tags: string[];
};

export type SessionMeta = Omit<Session, "segments" | "summary"> & {
  segmentCount: number;
  hasSummary: boolean;
};

export type ChatRole = "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

export type Retrieved = {
  segment: Segment;
  score: number;
};
