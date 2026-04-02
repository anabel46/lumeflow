import React, { createContext, useCallback, useState } from "react";
import { toast } from "sonner";

export const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const notify = useCallback((message, type = "info", data = null) => {
    const id = Date.now();
    const notification = { id, message, type, data, timestamp: new Date() };
    
    setNotifications(prev => [notification, ...prev].slice(0, 10));

    // Show toast based on type
    if (type === "rejection") {
      toast.error(message, {
        description: data?.product_name ? `OP: ${data.unique_number} - ${data.product_name}` : undefined,
        duration: 6000,
      });
    } else if (type === "return_issue") {
      toast.warning(message, {
        description: data?.product_name ? `OP: ${data.unique_number} - Qtd problema: ${data.issue_quantity}` : undefined,
        duration: 6000,
      });
    } else if (type === "success") {
      toast.success(message, { duration: 4000 });
    } else {
      toast.info(message, { duration: 4000 });
    }
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, notify, clearNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = React.useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}