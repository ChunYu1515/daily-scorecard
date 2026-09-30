import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./base.css";

// 用瀏覽器內建的 localStorage 提供和 Claude 相同的儲存介面，App 本身不用改
window.storage = {
  async get(key) {
    const value = localStorage.getItem(key);
    if (value === null) throw new Error("not found");
    return { key, value, shared: false };
  },
  async set(key, value) {
    localStorage.setItem(key, value);
    return { key, value, shared: false };
  },
  async delete(key) {
    localStorage.removeItem(key);
    return { key, deleted: true, shared: false };
  },
};

// 請瀏覽器把資料標成長期保存，降低被自動清除的機會
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

createRoot(document.getElementById("root")).render(<App />);
