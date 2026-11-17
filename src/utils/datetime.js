// src/utils/datetime.js

export const fmtDateTime = (date) => {
  if (!date) return "-";
  return new Date(date).toLocaleString();
};