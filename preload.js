const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('mawja', {
  dashboard: () => ipcRenderer.invoke('dashboard:get'),
  products: {
    list: q => ipcRenderer.invoke('products:list',q),
    save: p => ipcRenderer.invoke('products:save',p),
    delete: id => ipcRenderer.invoke('products:delete',id)
  },
  customers: { list: () => ipcRenderer.invoke('customers:list'), save: c => ipcRenderer.invoke('customers:save',c) },
  sales: {
    create: s => ipcRenderer.invoke('sales:create',s),
    list: q => ipcRenderer.invoke('sales:list',q),
    items: id => ipcRenderer.invoke('sales:items',id)
  },
  expenses: { list: () => ipcRenderer.invoke('expenses:list'), add: e => ipcRenderer.invoke('expenses:add',e) },
  reports: period => ipcRenderer.invoke('reports:get',period),
  backup: { create: () => ipcRenderer.invoke('backup:create'), restore: () => ipcRenderer.invoke('backup:restore') },
  info: () => ipcRenderer.invoke('app:info')
});
