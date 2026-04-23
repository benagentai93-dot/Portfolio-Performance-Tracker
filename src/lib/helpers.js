export const exportToCSV = (data, filename, headers) => {
  const bom = '﻿';
  const escapeCsvField = (field) => {
    if (field === null || field === undefined) return '';
    const stringField = String(field);
    if (stringField.includes(',')) {
      return `"${stringField}"`;
    }
    return stringField;
  };

  const csvContent = [
    headers.join(','),
    ...data.map((row) => row.map(escapeCsvField).join(',')),
  ].join('\n');

  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const exportToJSON = (data, filename) => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const parseStockCSV = (text) => {
  const cleanText = text.replace(/^﻿/, '');
  const lines = cleanText.split(/\r\n|\n|\r/).filter((line) => line.trim() !== '');

  if (lines.length < 2) return { error: '檔案內容太少或格式錯誤' };

  const headers = lines[0].toLowerCase().split(',').map((h) => h.trim());

  let dateIdx = headers.findIndex((h) => h.includes('date') || h.includes('日期'));
  let priceIdx = headers.findIndex((h) => h.includes('adj close'));
  if (priceIdx === -1)
    priceIdx = headers.findIndex((h) => h.includes('price') || h.includes('收市') || h.includes('收盤'));
  if (priceIdx === -1) priceIdx = headers.findIndex((h) => h.includes('close'));
  if (priceIdx === -1) priceIdx = headers.findIndex((h) => h.includes('當時價'));

  if (dateIdx === -1) dateIdx = 0;
  if (priceIdx === -1) priceIdx = 1;

  const result = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length <= Math.max(dateIdx, priceIdx)) continue;

    const dateStr = cols[dateIdx]?.trim();
    const priceStr = cols[priceIdx]?.trim()?.replace(/["',]/g, '');

    if (!dateStr || !priceStr) continue;

    let formattedDate;
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const m = parts[0].padStart(2, '0');
        const d = parts[1].padStart(2, '0');
        const y = parts[2];
        if (y.length === 4) {
          formattedDate = `${y}-${m}-${d}`;
        } else if (parts[0].length === 4) {
          formattedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
      }
    }

    if (!formattedDate) {
      const dateObj = new Date(dateStr);
      if (!isNaN(dateObj.getTime())) {
        formattedDate = dateObj.toISOString().split('T')[0];
      }
    }

    const price = parseFloat(priceStr);
    if (formattedDate && !isNaN(price)) {
      result.push({ date: formattedDate, close: price });
    }
  }

  if (result.length === 0) return { error: '無法解析數據，請檢查 CSV 格式。' };

  return { data: result.sort((a, b) => new Date(a.date) - new Date(b.date)) };
};

export const extractJSON = (text) => {
  if (!text) return null;
  try {
    let jsonStr = text.replace(/```json/g, '').replace(/```/g, '');
    const firstOpen = jsonStr.indexOf('{');
    const lastClose = jsonStr.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1) {
      jsonStr = jsonStr.substring(firstOpen, lastClose + 1);
      return JSON.parse(jsonStr);
    }
    return null;
  } catch (e) {
    console.error('JSON extraction failed', e);
    return null;
  }
};
