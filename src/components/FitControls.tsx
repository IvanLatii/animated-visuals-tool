export function FitControls({ value, onChange, overridden, onReset }:
  { value: 'fit' | 'fill'; onChange: (v: 'fit' | 'fill') => void; overridden: boolean; onReset?: () => void }) {
  return (
    <div className="group">
      <div className="subhead">
        <h3>Картинка в полотні{overridden && <em> · змінено для кадру</em>}</h3>
        {overridden && onReset && <button className="link" onClick={onReset}>Скинути</button>}
      </div>
      <div className="seg-buttons" role="group" aria-label="Заповнення">
        <button className={value === 'fill' ? 'on' : ''} onClick={() => onChange('fill')} title="Картинка заповнює все полотно, краї можуть обрізатися">Заповнити</button>
        <button className={value === 'fit' ? 'on' : ''} onClick={() => onChange('fit')} title="Картинка видна повністю, по боках може бути тло">Вмістити</button>
      </div>
    </div>
  );
}
