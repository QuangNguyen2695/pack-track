export class VideoModel {
  constructor(
    public id: string,
    public orderCode: string,
    public name: string,
    public startTime: Date,
    public endTime: Date,
    public duration: number,
    public status: "pending" | "recording" | "completed" | "failed",
  ) {}

  // Tính duration tự động nếu có start và end
  static calculateDuration(start: Date, end: Date): number {
    return (end.getTime() - start.getTime()) / 1000; // giây
  }
}
