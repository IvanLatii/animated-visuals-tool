/* Один набор иконок: 16×16, лінія 1.3, розмір за замовчуванням 14: усі однакові за вагою й розміром. */
interface IconProps { size?: number }
const base = (size: number) => ({ viewBox: '0 0 16 16', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true });

export function TrashIcon({ size = 14 }: IconProps) {
  return <svg {...base(size)}><path d="M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.6 8.5h6.8l.6-8.5M6.7 7v4M9.3 7v4" /></svg>;
}
export function CloseIcon({ size = 14 }: IconProps) {
  return <svg {...base(size)}><path d="M4 4l8 8M12 4l-8 8" /></svg>;
}
/** «Замінити зображення»: іконка картинки (раніше були дві стрілки, вони погано передавали зміст). */
export function ReplaceIcon({ size = 14 }: IconProps) {
  return <svg {...base(size)}><path d="M3.3 2.8h9.4a.5.5 0 0 1 .5.5v9.4a.5.5 0 0 1-.5.5H3.3a.5.5 0 0 1-.5-.5V3.3a.5.5 0 0 1 .5-.5zM2.8 11l3.2-3.2 2.4 2.4 1.6-1.6 2.6 2.6M10.4 6.2h.01" /></svg>;
}
export function PipetteIcon({ size = 14 }: IconProps) {
  return <svg {...base(size)}><path d="M9.2 3.6l3.2 3.2-1.4 1.4-3.2-3.2zM10.2 2.6l3.2 3.2M7.8 5 3.6 9.2M6.2 9.8 3.6 12.4c-.4.4-.4 1.2.2 1.8.6.6 1.4.6 1.8.2l2.6-2.6" /></svg>;
}
export function DropIcon({ size = 14 }: IconProps) {
  return <svg {...base(size)}><path d="M8 2.2c2.4 3 4 4.9 4 7a4 4 0 0 1-8 0c0-2.1 1.6-4 4-7z" /></svg>;
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
