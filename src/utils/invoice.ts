import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { Task } from '../api/types';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sampleTxnId(taskId: string): string {
  const compact = taskId.replaceAll('-', '').slice(0, 12).toUpperCase();
  return `TXN-${compact}`;
}

function buildInvoiceHtml(task: Task, actor: 'buyer' | 'helper'): string {
  const amount = Math.max(0, Number(task.budgetPaise || 0)) / 100;
  const createdAt = new Date(task.createdAt).toLocaleString();
  const completedAt = task.status === 'COMPLETED' ? new Date().toLocaleString() : '-';
  const roleLabel = actor === 'buyer' ? 'Citizen Invoice' : 'Partner Invoice';
  const partyLabel = actor === 'buyer' ? 'Superherooo Partner' : 'Citizen';
  const partyValue =
    actor === 'buyer'
      ? task.helperName || task.helperPhone || task.assignedHelperId || '-'
      : task.buyerName || task.buyerPhone || task.buyerId || '-';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #111827; padding: 20px; }
      .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
      .brand { font-size: 20px; font-weight: 700; color: #1d4ed8; }
      .muted { color: #6b7280; font-size: 12px; }
      .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; margin-bottom: 12px; }
      .title { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
      .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
      .k { color: #6b7280; }
      .v { color: #111827; font-weight: 600; }
      .total { font-size: 18px; color: #0f766e; font-weight: 800; }
      .foot { margin-top: 16px; font-size: 11px; color: #6b7280; }
    </style>
  </head>
  <body>
    <div class="head">
      <div>
        <div class="brand">Superherooo</div>
        <div class="muted">${escapeHtml(roleLabel)}</div>
      </div>
      <div class="muted">Generated: ${escapeHtml(new Date().toLocaleString())}</div>
    </div>
    <div class="card">
      <div class="title">${escapeHtml(task.title || 'Task')}</div>
      <div class="muted">${escapeHtml(task.description || '-')}</div>
      <div class="row"><span class="k">Task ID</span><span class="v">${escapeHtml(task.id)}</span></div>
      <div class="row"><span class="k">Transaction ID</span><span class="v">${escapeHtml(sampleTxnId(task.id))}</span></div>
      <div class="row"><span class="k">${partyLabel}</span><span class="v">${escapeHtml(partyValue)}</span></div>
      <div class="row"><span class="k">Status</span><span class="v">${escapeHtml(task.status)}</span></div>
      <div class="row"><span class="k">Created At</span><span class="v">${escapeHtml(createdAt)}</span></div>
      <div class="row"><span class="k">Completed At</span><span class="v">${escapeHtml(completedAt)}</span></div>
      <div class="row"><span class="k">Location</span><span class="v">${escapeHtml(task.addressText || `${task.lat}, ${task.lng}`)}</span></div>
      <div class="row"><span class="k">Estimated Time</span><span class="v">${escapeHtml(String(task.timeMinutes || 0))} min</span></div>
      <div class="row"><span class="k">Amount</span><span class="total">INR ${escapeHtml(amount.toFixed(0))}</span></div>
    </div>
    <div class="foot">
      This invoice is system-generated for task reference and support. Tax breakdown can be added with payment gateway integration.
    </div>
  </body>
</html>`;
}

export async function downloadTaskInvoice(task: Task, actor: 'buyer' | 'helper'): Promise<void> {
  try {
    const html = buildInvoiceHtml(task, actor);
    const printed = await Print.printToFileAsync({ html });
    const docs = FileSystem.documentDirectory || FileSystem.cacheDirectory;
    if (!docs) throw new Error('Missing app filesystem directory');
    const folder = `${docs}invoices`;
    await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
    const fileName = `invoice-${task.id.slice(0, 8)}-${actor}.pdf`;
    const dest = `${folder}/${fileName}`;
    await FileSystem.copyAsync({ from: printed.uri, to: dest });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(dest, {
        mimeType: 'application/pdf',
        dialogTitle: 'Download invoice',
      });
    } else {
      Alert.alert('Invoice ready', `Saved: ${dest}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Invoice download failed';
    Alert.alert('Invoice error', msg);
  }
}
