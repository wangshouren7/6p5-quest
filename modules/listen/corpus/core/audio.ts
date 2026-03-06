export function playWordAudio(audioUrl: string, rate: number): void {
  const audio = new Audio(audioUrl);
  audio.playbackRate = rate;
  void audio.play();
}
