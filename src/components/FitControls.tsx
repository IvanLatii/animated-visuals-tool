import { GroupTitle } from './AnimationControls';
import { Seg } from './ui';

export function FitControls({ value, onChange, overridden, onReset }:
  { value: 'fit' | 'fill'; onChange: (v: 'fit' | 'fill') => void; overridden: boolean; onReset?: () => void }) {
  return (
    <div className="group">
      <GroupTitle text="Картинка в полотні" overridden={overridden} onReset={onReset} />
      <Seg label="Заповнення" value={value} onChange={onChange} options={[
        { id: 'fill', label: 'Заповнити', title: 'Картинка заповнює все полотно, краї можуть обрізатися' },
        { id: 'fit', label: 'Вмістити', title: 'Картинка видна повністю, по боках може бути тло' },
      ]} />
    </div>
  );
}
