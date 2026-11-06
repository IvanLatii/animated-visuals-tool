/* Один набор иконок: 16×16, лінія 1.3, розмір за замовчуванням 14: усі однакові за вагою й розміром. */
interface IconProps { size?: number }
const base = (size: number) => ({ viewBox: '0 0 16 16', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true });

export function TrashIcon({ size = 14 }: IconProps) {
  return <svg {...base(size)}><path d="M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.6 8.5h6.8l.6-8.5M6.7 7v4M9.3 7v4" /></svg>;
}
export function CloseIcon({ size = 14 }: IconProps) {
  return <svg {...base(size)}><path d="M4 4l8 8M12 4l-8 8" /></svg>;
}
export function ReplaceIcon({ size = 14 }: IconProps) {
  return <svg {...base(size)}><path d="M3 5.5h9M9.5 3 12 5.5 9.5 8M13 10.5H4M6.5 8 4 10.5 6.5 13" /></svg>;
}
export function PlayIcon({ size = 14 }: IconProps) {
  return <svg {...base(size)} fill="currentColor" strokeWidth="0"><path d="M4.5 2.8v10.4L13 8z" /></svg>;
}
export function PauseIcon({ size = 14 }: IconProps) {
  return <svg {...base(size)} fill="currentColor" strokeWidth="0"><path d="M4 3h3v10H4zM9 3h3v10H9z" /></svg>;
}
export function LoopIcon({ size = 14 }: IconProps) {
  return <svg {...base(size)}><path d="M3 7V6.2A2.2 2.2 0 0 1 5.2 4H13M10.8 1.8 13 4l-2.2 2.2M13 9v.8A2.2 2.2 0 0 1 10.8 12H3M5.2 14 3 12l2.2-2.2" /></svg>;
}
