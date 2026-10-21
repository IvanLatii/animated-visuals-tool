import { GroupTitle } from './AnimationControls';
import { Seg } from './ui';

export function FitControls({ value, onChange, overridden, onReset }:
  { value: 'fit' | 'fill'; onChange: (v: 'fit' | 'fill') => void; overridden: boolean; onReset?: () => void }) {
  return (
    <div className="group">
      <GroupTitle text="Image in canvas" overridden={overridden} onReset={onReset} />
      <Seg label="Fit mode" value={value} onChange={onChange} options={[
        { id: 'fill', label: 'Fill' },
        { id: 'fit', label: 'Fit' },
      ]} />
    </div>
  );
}
