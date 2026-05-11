import { useState, useEffect, useRef } from "react";
import BeatLoader from "react-spinners/BeatLoader";

export default function CooldownButton({
  onClick,
  children,
  className = "",
  cooldownTime = 3,
  disabled = false,
  type = "button",
}) {
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);

  const lockRef = useRef(false); // 🔥 instant lock

  const handleClick = async (e) => {
    // 🔥 HARD BLOCK (prevents spam instantly)
    if (lockRef.current || cooldown > 0 || loading || disabled) return;

    lockRef.current = true;

    try {
      setLoading(true);
      setCooldown(cooldownTime);

      await onClick?.(e);
    } finally {
      setLoading(false);

      // 🔥 release lock AFTER small delay (ensures no double fire)
      setTimeout(() => {
        lockRef.current = false;
      }, 100);
    }
  };

  // countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  return (
    <button
      type={type}
      className={className}
      onClick={handleClick}
      disabled={cooldown > 0 || loading || disabled}
    >
      {loading ? (
        <BeatLoader size={8} color="#fff" />
      ) : cooldown > 0 ? (
        `${typeof children === "string" ? children : ""} (${cooldown}s)`
      ) : (
        children
      )}
    </button>
  );
}
