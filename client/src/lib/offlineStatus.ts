import { useEffect, useState } from "react";

function getOnlineStatus(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(getOnlineStatus);

  useEffect(() => {
    function updateOnlineStatus() {
      setOnline(getOnlineStatus());
    }

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    updateOnlineStatus();

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  return online;
}
