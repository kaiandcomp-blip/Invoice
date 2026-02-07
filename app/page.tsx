'use client';

import { useState, useEffect, useRef } from 'react';
import {
  EstimateData,
  getDefaultEstimateData,
  calculateSubtotal,
  calculateTax,
  calculateTotal,
  formatKRW,
  LineItem,
  generateDefaultFileName,
  generateEstimateNumber
} from '@/types/estimate';
import { saveAs } from 'file-saver';

const fontOptions = [
  { value: 'system', label: '기본 (Sans)', stack: 'var(--font-inter), system-ui, sans-serif' },
  { value: 'montserrat', label: 'Montserrat (고급)', stack: 'var(--font-montserrat), sans-serif' },
  { value: 'serif', label: 'Serif (명조)', stack: '"Times New Roman", Georgia, serif' },
  { value: 'mono', label: 'Mono (코드)', stack: 'ui-monospace, Consolas, monospace' },
];

const calculateValidityNotes = (issueDate: string, dueDate: string) => {
  if (!issueDate || !dueDate) return '본 견적서는 명시된 기간 동안 유효합니다.';
  const start = new Date(issueDate);
  const end = new Date(dueDate);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return '본 견적서는 발행 당일 유효합니다.';
  if (diffDays % 7 === 0) {
    return `본 견적서는 ${diffDays / 7}주간 유효합니다.`;
  }
  return `본 견적서는 ${diffDays}일간 유효합니다.`;
};

export default function Home() {
  const [estimate, setEstimate] = useState<EstimateData | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [lastExport, setLastExport] = useState<'pdf' | 'png' | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [sequence, setSequence] = useState(1);

  useEffect(() => {
    setIsClient(true);

    // Load sequence tracker
    const currentYear = new Date().getFullYear();
    const savedSequenceInfo = localStorage.getItem('invoice-sequence');
    let nextSeq = 1;

    if (savedSequenceInfo) {
      const { year, lastSeq } = JSON.parse(savedSequenceInfo);
      if (year === currentYear) {
        nextSeq = lastSeq;
      }
    }
    setSequence(nextSeq);

    const preferredTemplate = localStorage.getItem('preferred-template') as 'design1' | 'design2' | 'design3' | 'design4' | null;

    const saved = localStorage.getItem('estimate-data');
    if (saved) {
      const data = JSON.parse(saved);
      // Update issue date to today by default
      data.issueDate = new Date().toLocaleDateString('en-CA');
      data.dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA');
      data.notes = calculateValidityNotes(data.issueDate, data.dueDate);
      // Ensure preferred template is used if it exists
      if (preferredTemplate) {
        data.designTemplate = preferredTemplate;
      }
      setEstimate(data);
      return;
    }
    const defaultData = getDefaultEstimateData();
    defaultData.estimateNumber = generateEstimateNumber(nextSeq);
    defaultData.notes = calculateValidityNotes(defaultData.issueDate, defaultData.dueDate);
    if (preferredTemplate) {
      defaultData.designTemplate = preferredTemplate;
    }
    setEstimate(defaultData);
  }, []);

  const handleNewEstimate = () => {
    if (!confirm('현재 작업 중인 내용이 사라집니다. 새 견적서를 시작하겠습니까?')) return;

    const nextSeq = sequence + 1;
    setSequence(nextSeq);
    localStorage.setItem('invoice-sequence', JSON.stringify({
      year: new Date().getFullYear(),
      lastSeq: nextSeq
    }));

    const currentTemplate = estimate?.designTemplate || 'design1';
    const newEstimate = getDefaultEstimateData();
    newEstimate.designTemplate = currentTemplate;
    newEstimate.estimateNumber = generateEstimateNumber(nextSeq);
    newEstimate.notes = calculateValidityNotes(newEstimate.issueDate, newEstimate.dueDate);
    setEstimate(newEstimate);
    localStorage.setItem('estimate-data', JSON.stringify(newEstimate));
  };

  const handleSave = () => {
    if (!estimate) return;
    localStorage.setItem('estimate-data', JSON.stringify(estimate));
    alert('저장되었습니다!');
  };

  const handleSelectFolder = async () => {
    try {
      const response = await fetch('/api/select-folder', { method: 'POST' });
      const result = await response.json();
      if (result.success && result.path) {
        updateMeta('savePath', result.path);
      } else if (result.error !== 'Cancelled' && result.error) {
        alert('폴더 선택 중 오류 발생: ' + result.error);
      }
    } catch (error) {
      alert('폴더 선택 중 오류 발생: ' + error);
    }
  };

  const handleExportJSON = () => {
    if (!estimate) return;
    const blob = new Blob([JSON.stringify(estimate, null, 2)], { type: 'application/json' });
    let fileName = (estimate.fileName ?? '').trim();
    if (!fileName) {
      fileName = generateDefaultFileName(estimate.title, estimate.issueDate, sequence);
    }
    saveAs(blob, `${fileName}.json`);
  };

  const handleImportFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();

    if (file.name.endsWith('.json')) {
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          setEstimate(data);
          alert('데이터를 성공적으로 불러왔습니다.');
        } catch (err) {
          alert('올바른 JSON 파일이 아닙니다.');
        }
      };
      reader.readAsText(file);
    } else if (file.name.endsWith('.pdf')) {
      // Basic PDF metadata reading (searching for keywords where jspdf stores it)
      reader.onload = (e) => {
        try {
          const text = new TextDecoder().decode(e.target?.result as ArrayBuffer);
          const startMarker = '%---INVOICE_DATA_START---%';
          const endMarker = '%---INVOICE_DATA_END---%';

          const startIndex = text.indexOf(startMarker);
          const endIndex = text.indexOf(endMarker);

          if (startIndex !== -1 && endIndex !== -1) {
            const dataStr = text.substring(startIndex + startMarker.length, endIndex).trim();
            const data = JSON.parse(decodeURIComponent(dataStr));
            setEstimate(data);
            alert('PDF에서 데이터를 성공적으로 불러왔습니다!');
          } else {
            alert('이 PDF에는 불러올 수 있는 편집 데이터가 포함되어 있지 않거나, 구버전 PDF입니다.');
          }
        } catch (err) {
          alert('PDF 데이터를 읽는 중 오류가 발생했습니다.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert('지원되지 않는 파일 형식입니다. (.json 또는 .pdf)');
    }
  };

  const previewRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    if (!previewRef.current || !estimate) return;
    setIsExporting(true);
    setLastExport('pdf');
    const { toPng } = await import('html-to-image');
    const { jsPDF } = await import('jspdf');
    // Reduce quality to 0.7 to keep file size manageable
    const dataUrl = await toPng(previewRef.current, { quality: 0.7 });

    // Create PDF with custom height to fit all content on one page
    const img = new Image();
    img.src = dataUrl;
    await new Promise((resolve) => { img.onload = resolve; });

    const pdfWidth = 210; // A4 width in mm
    const pdfHeight = (img.height * pdfWidth) / img.width;

    const pdf = new jsPDF({
      orientation: pdfHeight > pdfWidth ? 'portrait' : 'landscape',
      unit: 'mm',
      format: [pdfWidth, pdfHeight]
    });

    // Embed estimate data as metadata in Keywords field
    const projectData = encodeURIComponent(JSON.stringify(estimate));
    pdf.setProperties({
      title: estimate.title,
      subject: 'Invoice generated by Invoice Maker',
      keywords: projectData
    });

    // Embed estimate data as a hidden block at the end of the PDF
    const jsonString = JSON.stringify(estimate);
    const dataBlock = `\n%---INVOICE_DATA_START---%\n${encodeURIComponent(jsonString)}\n%---INVOICE_DATA_END---%`;

    // Convert PDF to blob to append data safely
    const pdfBlob = pdf.output('blob');
    const reader = new FileReader();
    reader.onload = async () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const decoder = new TextDecoder();
      const existingContent = decoder.decode(arrayBuffer);

      const fileName = (estimate.fileName ?? '').trim() || generateDefaultFileName(estimate.title, estimate.issueDate, sequence);
      const finalFileName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;

      // Use the blob constructor to append the data block to the original PDF binary
      const finalBlob = new Blob([arrayBuffer, dataBlock], { type: 'application/pdf' });

      if (estimate.savePath) {
        // For API save, we need base64 of the final combined blob
        const finalReader = new FileReader();
        finalReader.onload = async () => {
          const finalDataUri = finalReader.result as string;
          try {
            const response = await fetch('/api/save-file', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filePath: estimate.savePath + '/' + finalFileName, contentBase64: finalDataUri, type: 'pdf' }),
            });
            const result = await response.json();
            if (result.success) {
              alert(`파일이 지정된 경로에 저장되었습니다:\n${result.path}`);
            } else {
              alert('파일 저장 실패: ' + result.error);
            }
          } catch (error) {
            alert('파일 저장 실패: ' + error);
          }
        };
        finalReader.readAsDataURL(finalBlob);
      } else {
        saveAs(finalBlob, finalFileName);
      }
    };
    reader.readAsArrayBuffer(pdfBlob);

    setIsExporting(false);
  };

  const handleExportImage = async () => {
    if (!previewRef.current || !estimate) return;
    setIsExporting(true);
    setLastExport('png');
    const { toPng } = await import('html-to-image');
    // Reduce quality to 0.7 to keep file size manageable
    const dataUrl = await toPng(previewRef.current, { quality: 0.7 });

    let fileName = (estimate.fileName ?? '').trim();
    if (!fileName) {
      fileName = generateDefaultFileName(estimate.title, estimate.issueDate, sequence);
    }

    if (!fileName.toLowerCase().endsWith('.png')) {
      fileName = `${fileName}.png`;
    }

    // Use custom save path if provided, otherwise fall back to browser download
    if (estimate.savePath) {
      try {
        const response = await fetch('/api/save-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: estimate.savePath + '/' + fileName, contentBase64: dataUrl, type: 'png' }),
        });
        const result = await response.json();
        if (result.success) {
          alert(`파일이 지정된 경로에 저장되었습니다:\n${result.path}`);
        } else {
          alert('파일 저장 실패: ' + result.error);
        }
      } catch (error) {
        alert('파일 저장 실패: ' + error);
      }
    } else {
      // Use file-saver for correct filename
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      saveAs(blob, fileName);
    }

    setIsExporting(false);
  };

  const updateSender = (field: keyof EstimateData['sender'], value: string) => {
    setEstimate(prev => {
      if (!prev) return prev;
      return { ...prev, sender: { ...prev.sender, [field]: value } };
    });
  };

  const updateMeta = (field: 'title' | 'fileName' | 'fontFamily' | 'issueDate' | 'savePath' | 'dueDate' | 'estimateNumber' | 'designTemplate', value: string | number) => {
    setEstimate(prev => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };

      // Persist design template preference
      if (field === 'designTemplate') {
        localStorage.setItem('preferred-template', value as string);
      }

      // Update validity notes if dates change
      if (field === 'issueDate' || field === 'dueDate') {
        updated.notes = calculateValidityNotes(updated.issueDate, updated.dueDate);
      }

      return updated;
    });
  };

  const handleLogoUpload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setEstimate(prev => (prev ? { ...prev, logoDataUrl: reader.result as string } : prev));
    };
    reader.readAsDataURL(file);
  };

  const updateRecipient = (field: keyof EstimateData['recipient'], value: string) => {
    setEstimate(prev => {
      if (!prev) return prev;
      return { ...prev, recipient: { ...prev.recipient, [field]: value } };
    });
  };

  const updatePayment = (field: keyof EstimateData['paymentInfo'], value: string) => {
    setEstimate(prev => {
      if (!prev) return prev;
      return { ...prev, paymentInfo: { ...prev.paymentInfo, [field]: value } };
    });
  };

  const addItem = () => {
    if (!estimate) return;
    const newItem: LineItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
    };
    setEstimate(prev => {
      if (!prev) return prev;
      return { ...prev, items: [...prev.items, newItem] };
    });
  };

  const removeItem = (id: string) => {
    setEstimate(prev => {
      if (!prev) return prev;
      return { ...prev, items: prev.items.filter(item => item.id !== id) };
    });
  };

  const updateItem = (id: string, field: keyof LineItem, value: string | number) => {
    setEstimate(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(item => {
          if (item.id !== id) return item;
          const updated = { ...item, [field]: value };
          if (field === 'quantity' || field === 'unitPrice') {
            updated.total = updated.quantity * updated.unitPrice;
          }
          return updated;
        }),
      };
    });
  };

  if (!isClient || !estimate) {
    return <div className="min-h-screen bg-slate-100" />;
  }

  const subtotal = calculateSubtotal(estimate.items);
  const discountAmount = Math.round(subtotal * ((estimate.discountRate ?? 0) / 100));
  const discountedSubtotal = subtotal - discountAmount;
  const tax = calculateTax(discountedSubtotal, estimate.taxRate);
  const total = calculateTotal(discountedSubtotal, tax);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div data-export-status={lastExport ?? ''} className="sr-only" />
      <div className="flex h-screen">
        <div className="w-[30%] bg-white border-r border-gray-200 overflow-y-auto shadow-sm">
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-bold">견적서메이커</h1>
              <div className="flex gap-2">
                <button
                  onClick={handleNewEstimate}
                  className="px-3 py-2 text-xs bg-blue-50 text-blue-600 rounded border border-blue-100 hover:bg-blue-100 transition-colors"
                >
                  새 견적서
                </button>
                <button className="px-4 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200">
                  로그인
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                value={estimate.title ?? ''}
                onChange={(e) => updateMeta('title', e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="견적서 제목"
              />
              <input
                type="text"
                value={estimate.fileName ?? ''}
                onChange={(e) => updateMeta('fileName', e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder={generateDefaultFileName(estimate.title, estimate.issueDate, sequence)}
              />
              <input
                type="text"
                value={estimate.estimateNumber ?? ''}
                onChange={(e) => updateMeta('estimateNumber', e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="견적 번호 (예: INV-2026-001)"
              />
              <div className="relative group">
                <input
                  type="text"
                  value={estimate.savePath ?? ''}
                  onChange={(e) => updateMeta('savePath', e.target.value)}
                  className="w-full px-3 py-2 border rounded pr-10"
                  placeholder="저장 경로 (예: /Users/jason/Documents)"
                />
                <button
                  onClick={handleSelectFolder}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="폴더 선택"
                >
                  📁
                </button>
              </div>
              <div>
                <label className="text-xs text-slate-500">발행일</label>
                <input
                  type="date"
                  value={estimate.issueDate ?? ''}
                  onChange={(e) => updateMeta('issueDate', e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">만료일</label>
                <input
                  type="date"
                  value={estimate.dueDate ?? ''}
                  onChange={(e) => updateMeta('dueDate', e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">폰트</label>
                <select
                  value={estimate.fontFamily ?? 'system'}
                  onChange={(e) => updateMeta('fontFamily', e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded"
                >
                  {fontOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">디자인 템플릿</label>
                <select
                  value={estimate.designTemplate ?? 'design1'}
                  onChange={(e) => updateMeta('designTemplate', e.target.value as any)}
                  className="mt-1 w-full px-3 py-2 border rounded"
                >
                  <option value="design1">디자인 1 (모던)</option>
                  <option value="design2">디자인 2 (클래식)</option>
                  <option value="design3">디자인 3 (미니멀)</option>
                  <option value="design4">디자인 4 (사이드바)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-500">로고 설정</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleLogoUpload(e.target.files?.[0] ?? null)}
                  className="w-full text-sm"
                />
                {estimate.logoDataUrl && (
                  <div className="flex items-center gap-3">
                    <img
                      src={estimate.logoDataUrl}
                      alt="로고 미리보기"
                      className="h-10 w-10 object-contain border rounded"
                    />
                    <button
                      type="button"
                      onClick={() => setEstimate(prev => (prev ? { ...prev, logoDataUrl: null } : prev))}
                      className="text-xs text-slate-500 underline"
                    >
                      제거
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleSave}
                className="w-full py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 flex items-center justify-center gap-2"
              >
                <span>✓</span> 저장됨
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <span>↓</span> PDF
                </button>
                <button
                  onClick={handleExportImage}
                  disabled={isExporting}
                  className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <span>🖼</span> 이미지
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleExportJSON}
                  className="py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
                >
                  데이터 저장 (JSON)
                </button>
                <label className="py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 cursor-pointer flex items-center justify-center">
                  불러오기 (.json/.pdf)
                  <input
                    type="file"
                    className="hidden"
                    accept=".json,.pdf"
                    onChange={(e) => handleImportFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>

            <div className="text-sm text-slate-500">공급자 & 수신자</div>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <h3 className="font-medium">공급자 (Sender)</h3>
                <input
                  type="text"
                  value={estimate.sender.name ?? ''}
                  onChange={(e) => updateSender('name', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="회사명"
                />
                <input
                  type="text"
                  value={estimate.sender.address ?? ''}
                  onChange={(e) => updateSender('address', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="주소"
                />
                <input
                  type="email"
                  value={estimate.sender.email ?? ''}
                  onChange={(e) => updateSender('email', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="이메일"
                />
                <input
                  type="tel"
                  value={estimate.sender.phone ?? ''}
                  onChange={(e) => updateSender('phone', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="전화번호"
                />
                <input
                  type="text"
                  value={estimate.sender.businessNumber ?? ''}
                  onChange={(e) => updateSender('businessNumber', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="사업자번호"
                />
              </div>

              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <h3 className="font-medium">수신자 (Recipient)</h3>
                <input
                  type="text"
                  value={estimate.recipient.name ?? ''}
                  onChange={(e) => updateRecipient('name', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="회사명"
                />
                <input
                  type="text"
                  value={estimate.recipient.address ?? ''}
                  onChange={(e) => updateRecipient('address', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="주소"
                />
                <input
                  type="email"
                  value={estimate.recipient.email ?? ''}
                  onChange={(e) => updateRecipient('email', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="이메일"
                />
                <input
                  type="tel"
                  value={estimate.recipient.phone ?? ''}
                  onChange={(e) => updateRecipient('phone', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="전화번호"
                />
              </div>

              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <h3 className="font-medium">계좌 정보 (Payment)</h3>
                <input
                  type="text"
                  value={estimate.paymentInfo.bankName ?? ''}
                  onChange={(e) => updatePayment('bankName', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="은행명"
                />
                <input
                  type="text"
                  value={estimate.paymentInfo.accountNumber ?? ''}
                  onChange={(e) => updatePayment('accountNumber', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="계좌번호"
                />
                <input
                  type="text"
                  value={estimate.paymentInfo.accountHolder ?? ''}
                  onChange={(e) => updatePayment('accountHolder', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="예금주"
                />
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">견적 항목</h3>
                  <button
                    onClick={addItem}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    + 추가
                  </button>
                </div>
                <div className="space-y-2">
                  {estimate.items.map((item) => (
                    <div key={item.id} className="flex gap-2 items-start">
                      <input
                        type="text"
                        value={item.description ?? ''}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        className="flex-1 px-3 py-2 border rounded text-sm"
                        placeholder="품목명"
                      />
                      <input
                        type="number"
                        value={item.quantity ?? 0}
                        onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-2 border rounded text-sm"
                        placeholder="수량"
                      />
                      <input
                        type="number"
                        value={item.unitPrice ?? 0}
                        onChange={(e) => updateItem(item.id, 'unitPrice', parseInt(e.target.value) || 0)}
                        className="w-24 px-2 py-2 border rounded text-sm"
                        placeholder="단가"
                      />
                      <button
                        onClick={() => removeItem(item.id)}
                        className="px-2 py-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-4">
                  <div>
                    <label className="text-xs text-slate-500">할인율(%)</label>
                    <input
                      type="number"
                      value={estimate.discountRate ?? 0}
                      onChange={(e) => {
                        const rate = Number(e.target.value);
                        setEstimate(prev => (prev ? { ...prev, discountRate: rate } : prev));
                      }}
                      className="mt-1 w-20 px-3 py-2 border rounded text-sm"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">부가세율(%)</label>
                    <input
                      type="number"
                      value={Math.round((estimate.taxRate ?? 0) * 100)}
                      onChange={(e) => {
                        const rate = Number(e.target.value);
                        setEstimate(prev => (prev ? { ...prev, taxRate: rate / 100 } : prev));
                      }}
                      className="mt-1 w-20 px-3 py-2 border rounded text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <h3 className="font-medium">비고 (Notes)</h3>
                <textarea
                  value={estimate.notes ?? ''}
                  onChange={(e) => setEstimate(prev => (prev ? { ...prev, notes: e.target.value } : prev))}
                  className="w-full px-3 py-2 border rounded h-20"
                  placeholder="비고사항"
                />
              </div>

              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <h3 className="font-medium">이용 약관 (Terms)</h3>
                <textarea
                  value={estimate.terms ?? ''}
                  onChange={(e) => setEstimate(prev => (prev ? { ...prev, terms: e.target.value } : prev))}
                  className="w-full px-3 py-2 border rounded h-20"
                  placeholder="이용 약관"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="w-[70%] bg-slate-100 overflow-y-auto p-8">
          <div
            ref={previewRef}
            data-preview="true"
            className="bg-white shadow-lg max-w-3xl mx-auto p-12 min-h-[800px] rounded-xl"
            style={{ fontFamily: fontOptions.find(option => option.value === estimate.fontFamily)?.stack }}
          >
            {estimate.designTemplate === 'design2' ? (
              /* Design 2: Classic/Formal */
              <div className="flex flex-col h-full">
                <div className="text-center pb-10 border-b-4 border-slate-900 mb-10">
                  <h1 className="text-4xl font-serif font-bold tracking-[0.3em] uppercase">{estimate.title || '견적서'}</h1>
                  <p className="text-gray-500 mt-2 font-mono">No. {estimate.estimateNumber}</p>
                </div>

                <div className="grid grid-cols-2 gap-12 mb-12">
                  <div className="border-l-4 border-slate-900 pl-6">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Supplier</h3>
                    <p className="font-bold text-xl mb-1">{estimate.sender.name}</p>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {estimate.sender.address}<br />
                      Tel: {estimate.sender.phone}<br />
                      Email: {estimate.sender.email}
                    </p>
                  </div>
                  <div className="border-r-4 border-gray-200 pr-6 text-right">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Client</h3>
                    <p className="font-bold text-xl mb-1">{estimate.recipient.name}</p>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {estimate.recipient.address}<br />
                      발행일: {estimate.issueDate}<br />
                      만료일: {estimate.dueDate}
                    </p>
                  </div>
                </div>

                <table className="w-full mb-10 border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="p-4 border border-slate-800 text-left">Description</th>
                      <th className="p-4 border border-slate-800 text-center w-20">Qty</th>
                      <th className="p-4 border border-slate-800 text-right w-32">Unit Price</th>
                      <th className="p-4 border border-slate-800 text-right w-32">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimate.items.map((item) => (
                      <tr key={item.id}>
                        <td className="p-4 border border-gray-200 font-medium">{item.description}</td>
                        <td className="p-4 border border-gray-200 text-center">{item.quantity}</td>
                        <td className="p-4 border border-gray-200 text-right">{formatKRW(item.unitPrice)}</td>
                        <td className="p-4 border border-gray-200 text-right font-bold">{formatKRW(item.total)}</td>
                      </tr>
                    ))}
                    {[...Array(Math.max(0, 5 - estimate.items.length))].map((_, i) => (
                      <tr key={i} className="h-12">
                        <td className="border border-gray-100"></td>
                        <td className="border border-gray-100"></td>
                        <td className="border border-gray-100"></td>
                        <td className="border border-gray-100"></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold">
                      <td colSpan={3} className="p-4 border border-gray-300 text-right uppercase tracking-widest text-sm">TOTAL AMOUNT</td>
                      <td className="p-4 border border-gray-300 text-right text-xl">{formatKRW(total)}</td>
                    </tr>
                  </tfoot>
                </table>

                <div className="mt-auto grid grid-cols-2 gap-10">
                  <div className="p-6 bg-slate-50 border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Bank Information</h4>
                    <p className="text-sm leading-relaxed">
                      <strong>{estimate.paymentInfo.bankName}</strong><br />
                      {estimate.paymentInfo.accountNumber}<br />
                      예금주: {estimate.paymentInfo.accountHolder}
                    </p>
                  </div>
                  <div className="text-xs text-gray-500 leading-relaxed italic">
                    <p className="mb-4">Note: {estimate.notes}</p>
                    <p>Terms: {estimate.terms}</p>
                  </div>
                </div>
              </div>
            ) : estimate.designTemplate === 'design3' ? (
              /* Design 3: Minimalist/Bold */
              <div className="flex flex-col h-full text-slate-900">
                <div className="flex justify-between items-end mb-20">
                  <div className="flex-1">
                    <div className="w-16 h-2 bg-blue-600 mb-6"></div>
                    <h1 className="text-5xl font-black italic tracking-tighter mb-2">{estimate.title || '견적서'}</h1>
                    <p className="text-blue-600 font-mono text-sm tracking-widest">#{estimate.estimateNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg mb-1">{estimate.sender.name}</p>
                    <p className="text-xs text-slate-400">{estimate.sender.phone}</p>
                  </div>
                </div>

                <div className="flex mb-20 gap-20">
                  <div className="w-1/3">
                    <h3 className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.3em] mb-4">Invoice To</h3>
                    <p className="font-bold text-2xl mb-2">{estimate.recipient.name}</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{estimate.recipient.address}</p>
                  </div>
                  <div className="w-1/3">
                    <h3 className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.3em] mb-4">Dates</h3>
                    <p className="text-xs border-b border-slate-100 pb-2 mb-2 flex justify-between">
                      <span className="text-slate-400 underline">Issued</span>
                      <span className="font-bold">{estimate.issueDate}</span>
                    </p>
                    <p className="text-xs flex justify-between">
                      <span className="text-slate-400 underline">Due</span>
                      <span className="font-bold">{estimate.dueDate}</span>
                    </p>
                  </div>
                  <div className="w-1/3 text-right">
                    <h3 className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.3em] mb-4">Total</h3>
                    <p className="text-4xl font-black text-blue-600">{formatKRW(total)}</p>
                  </div>
                </div>

                <div className="flex-1 space-y-8 mb-20">
                  {estimate.items.map((item, i) => (
                    <div key={item.id} className="group relative">
                      <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity">
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-slate-100">
                        <div className="flex-1">
                          <h4 className="font-bold text-lg">{item.description}</h4>
                          <span className="text-[10px] text-slate-400">{item.quantity} units · {formatKRW(item.unitPrice)}/each</span>
                        </div>
                        <div className="text-2xl font-black text-slate-800 tracking-tighter">
                          {formatKRW(item.total)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-900 text-white p-12 rounded-[32px] flex items-center justify-between">
                  <div>
                    <h4 className="text-blue-400 text-[10px] font-bold uppercase tracking-[0.4em] mb-4">Transfer Details</h4>
                    <p className="text-xl font-bold">{estimate.paymentInfo.bankName}</p>
                    <p className="text-sm font-mono text-slate-400 mb-1">{estimate.paymentInfo.accountNumber}</p>
                    <p className="text-sm text-slate-400">Owner: {estimate.paymentInfo.accountHolder}</p>
                  </div>
                  <div className="text-right max-w-xs">
                    <h4 className="text-blue-400 text-[10px] font-bold uppercase tracking-[0.4em] mb-4">Notice</h4>
                    <p className="text-[10px] leading-relaxed text-slate-300 opacity-70 italic whitespace-pre-wrap">{estimate.notes}</p>
                  </div>
                </div>
              </div>
            ) : estimate.designTemplate === 'design4' ? (
              /* Design 4: Professional Sidebar (Based on user-provided HTML/CSS) */
              <div className="flex -m-12 min-h-[1000px] overflow-hidden">
                {/* Sidebar Styling */}
                <div className="w-[30%] bg-[#f2f2f2] p-10 flex flex-col" style={{ color: '#333' }}>
                  <div className="mb-[60px]">
                    {estimate.logoDataUrl ? (
                      <img src={estimate.logoDataUrl} alt="Logo" className="max-h-16 mb-2" />
                    ) : (
                      <div className="text-[48px] font-black leading-none tracking-[-2px]">●N</div>
                    )}
                    <div className="text-[18px] font-bold tracking-[1px] mt-1.5 uppercase">{estimate.sender.name}</div>
                  </div>

                  <div className="mb-[40px]">
                    <h3 className="text-[14px] font-bold uppercase border-b border-[#ccc] pb-1.5 mb-[15px] tracking-[1px]">Invoice To</h3>
                    <p className="text-[12px] font-bold mb-1">{estimate.recipient.name}</p>
                    <p className="text-[12px] text-[#555] leading-[1.6]">
                      {estimate.recipient.address}<br />
                      Town/City<br />
                      State, County 556
                    </p>
                    <p className="text-[12px] text-[#555] leading-[1.6] mt-2.5">P: {estimate.recipient.phone}</p>
                    <p className="text-[12px] text-[#555] leading-[1.6]">M: {estimate.recipient.email}</p>
                  </div>

                  <div className="mb-[40px]">
                    <h3 className="text-[14px] font-bold uppercase border-b border-[#ccc] pb-1.5 mb-[15px] tracking-[1px]">Payment</h3>
                    <p className="text-[12px] font-bold mb-1">Bank Account</p>
                    <p className="text-[12px] text-[#555] leading-[1.6]">{estimate.paymentInfo.bankName}<br />{estimate.paymentInfo.accountNumber}</p>
                    <p className="text-[12px] font-bold mb-1 mt-2.5">{estimate.paymentInfo.accountHolder}</p>
                    <p className="text-[12px] text-[#555] leading-[1.6]">Account Holder</p>
                  </div>

                  <div className="mb-[40px]">
                    <h3 className="text-[14px] font-bold uppercase border-b border-[#ccc] pb-1.5 mb-[15px] tracking-[1px]">Terms</h3>
                    <p className="text-[12px] text-[#555] leading-[1.6] italic">
                      {estimate.terms || '지정된 기한 내 결제 부탁드립니다.'}
                    </p>
                  </div>
                </div>

                {/* Main Content Area */}
                <div className="w-[70%] bg-white p-12 flex flex-col min-h-[1000px]">
                  <div className="text-right mb-[80px]">
                    <h1 className="text-[42px] font-light uppercase tracking-[10px] m-0" style={{ fontFamily: 'var(--font-montserrat)' }}>Invoice</h1>
                    <p className="text-[14px] text-[#666] m-0 mt-1.5">Invoice# {estimate.estimateNumber}</p>
                  </div>

                  <div className="mb-[50px]">
                    <div className="mb-[15px]">
                      <span className="text-[13px] block mb-1">Date: {estimate.issueDate}</span>
                    </div>
                    <div>
                      <span className="text-[13px] block mb-1">Total Due:</span>
                      <span className="text-[24px] font-bold">{formatKRW(total)}</span>
                    </div>
                  </div>

                  <table className="w-full mb-[40px] border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left py-2.5 border-b-2 border-black text-[13px] uppercase tracking-[1px] w-[50%]">Description</th>
                        <th className="text-right py-2.5 border-b-2 border-black text-[13px] uppercase tracking-[1px]">Price</th>
                        <th className="text-right py-2.5 border-b-2 border-black text-[13px] uppercase tracking-[1px] w-16">Qty</th>
                        <th className="text-right py-2.5 border-b-2 border-black text-[13px] uppercase tracking-[1px]">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {estimate.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-[15px] text-[13px] font-medium">{item.description}</td>
                          <td className="py-[15px] text-right text-[13px]">{formatKRW(item.unitPrice)}</td>
                          <td className="py-[15px] text-right text-[13px]">{item.quantity}</td>
                          <td className="py-[15px] text-right text-[13px]">{formatKRW(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-auto">
                    <div className="flex justify-between items-end">
                      {/* Signature */}
                      <div className="w-[200px]">
                        <div className="signature text-left">
                          <p className="text-[32px] m-0 leading-none opacity-80" style={{ fontFamily: 'var(--font-dancing-script)' }}>{estimate.sender.name}</p>
                          <p className="text-[12px] border-t border-[#ccc] pt-1.5 mt-2 text-[#666] leading-relaxed">
                            {estimate.sender.name}<br />Account Manager
                          </p>
                        </div>
                      </div>

                      {/* Totals Section */}
                      <div className="w-[220px]">
                        <div className="flex justify-between mb-2 text-[13px]">
                          <span>Sub Total</span>
                          <span>{formatKRW(subtotal)}</span>
                        </div>
                        <div className="flex justify-between mb-2 text-[13px]">
                          <span>Tax {Math.round(estimate.taxRate * 100)}%</span>
                          <span>{formatKRW(tax)}</span>
                        </div>
                        <div className="flex justify-between border border-black p-2.5 mt-[15px] font-bold text-[15px] uppercase">
                          <span>TOTAL</span>
                          <span>{formatKRW(total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Design 1: Modern/Clean (Balanced) */
              <>
                <div className="mb-8">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      {estimate.logoDataUrl && (
                        <img
                          src={estimate.logoDataUrl}
                          alt="로고"
                          className="h-10 mb-3 object-contain"
                        />
                      )}
                      <h1 className="text-3xl font-bold mb-2">{estimate.title || '견적서'}</h1>
                      <p className="text-gray-600">NO. {estimate.estimateNumber}</p>
                    </div>
                    <div className="text-right text-sm text-gray-600">
                      <p className="font-bold text-lg text-black mb-1">{estimate.sender.name}</p>
                      <p>{estimate.sender.address}</p>
                      <p>{estimate.sender.email}</p>
                      <p>{estimate.sender.phone}</p>
                      <p>등록번호: {estimate.sender.businessNumber}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-8 mb-8">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">청구/수신 (BILL TO)</p>
                      <p className="font-bold text-lg">{estimate.recipient.name}</p>
                      <p className="text-sm text-gray-600">{estimate.recipient.address}</p>
                      <p className="text-sm text-gray-600">{estimate.recipient.email}</p>
                      <p className="text-sm text-gray-600">{estimate.recipient.phone}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">발행일 (DATE)</p>
                      <p className="font-medium">{estimate.issueDate}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">만료일 (DUE DATE)</p>
                      <p className="font-medium">{estimate.dueDate}</p>
                    </div>
                  </div>
                </div>

                <table className="w-full mb-8">
                  <thead>
                    <tr className="border-b-2 border-gray-800">
                      <th className="text-left py-3 font-medium">품목</th>
                      <th className="text-center py-3 font-medium w-20">수량</th>
                      <th className="text-right py-3 font-medium w-32">단가</th>
                      <th className="text-right py-3 font-medium w-32">합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimate.items.map((item) => (
                      <tr key={item.id} className="border-b border-gray-200">
                        <td className="py-3">
                          <p className="font-medium">{item.description}</p>
                        </td>
                        <td className="text-center py-3">{item.quantity}</td>
                        <td className="text-right py-3">{formatKRW(item.unitPrice)}</td>
                        <td className="text-right py-3">{formatKRW(item.quantity * item.unitPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-end mb-8">
                  <div className="w-80">
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">소계</span>
                      <span>{formatKRW(subtotal)}</span>
                    </div>
                    {(estimate.discountRate ?? 0) > 0 && (
                      <div className="flex justify-between py-2">
                        <span className="text-red-500">할인 (-{estimate.discountRate}%)</span>
                        <span className="text-red-500">-{formatKRW(Math.round(subtotal * (estimate.discountRate / 100)))}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">부가세 ({Math.round((estimate.taxRate ?? 0.1) * 100)}%)</span>
                      <span>{formatKRW(tax)}</span>
                    </div>
                    <div className="flex justify-between py-3 border-t-2 border-gray-800 font-bold text-lg">
                      <span className="text-blue-600">총계</span>
                      <span className="text-blue-600">{formatKRW(total)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-8 border-t border-gray-100">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">계좌 정보 (PAYMENT INFO)</p>
                    <p className="font-medium text-sm">{estimate.paymentInfo.bankName} | {estimate.paymentInfo.accountNumber}</p>
                    <p className="text-xs text-gray-600">예금주: {estimate.paymentInfo.accountHolder}</p>

                    <div className="mt-6">
                      <p className="text-sm text-gray-500 mb-1">비고 (NOTES)</p>
                      <p className="text-xs whitespace-pre-wrap">{estimate.notes}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">이용 약관 (TERMS)</p>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">{estimate.terms}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
