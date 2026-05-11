// scr/Utilities/QuantityInput
import "./QuantityInput.css";
import { FaPlus, FaMinus } from "react-icons/fa6";
import { useRef } from "react";

export default function QuantityInput({ value, onChange, min = 0, max }) {
  const intervalRef = useRef(null);

  const decrease = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };

  const increase = () => {
    if (!max || value < max) {
      onChange(value + 1);
    }
  };

  const startHold = (action) => {
    action(); // run once immediately

    intervalRef.current = setInterval(() => {
      action();
    }, 120); // speed of continuous change
  };

  const stopHold = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleChange = (e) => {
    let val = Number(e.target.value);

    if (isNaN(val)) return;

    if (val < min) val = min;
    if (max && val > max) val = max;

    onChange(val);
  };

  return (
    <div className="qty-input">
      <button
        type="button"
        className="qty-btn"
        disabled={value <= min}
        onMouseDown={() => startHold(decrease)}
        onMouseUp={stopHold}
        onMouseLeave={stopHold}
        onTouchStart={() => startHold(decrease)}
        onTouchEnd={stopHold}
      >
        <FaMinus />
      </button>

      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={handleChange}
        className="qty-field"
      />

      <button
        type="button"
        className="qty-btn"
        disabled={max && value >= max}
        onMouseDown={() => startHold(increase)}
        onMouseUp={stopHold}
        onMouseLeave={stopHold}
        onTouchStart={() => startHold(increase)}
        onTouchEnd={stopHold}
      >
        <FaPlus />
      </button>
    </div>
  );
}
