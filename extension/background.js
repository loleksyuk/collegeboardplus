importScripts('shared.js');
chrome.runtime.onInstalled.addListener(async () => {
  const { global } = await chrome.storage.local.get('global');
  if (!global) await chrome.storage.local.set({ global: PageColors.defaults });
});
