'use client';

import { useState, useEffect, useRef } from 'react';
import {
  EstimateData,
  getDefaultEstimateData,
  calculateSubtotal,
  calculateTax,
  calculateTotal,
  formatKRW,
  LineItem
} from '@/types/estimate';

const fontOptions = [
  { value: 'system', label: '기본 (Sans)', stack: 'system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif' },
  { value: 'serif', label: 'Serif', stack: '"Times New Roman", Georgia, serif' },
  { value: 'mono', label: 'Mono', stack: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' },
  { value: 'rounded', label: 'Rounded', stack: '"Trebuchet MS", "Arial Rounded MT Bold", "Noto Sans KR", sans-serif' },
];

export default function Home() {
  const [estimate, setEstimate] = useState<EstimateData | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [lastExport, setLastExport] = useState<'pdf' | 'png' | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const saved = localStorage.getItem('estimate-data');
    if (saved) {
      setEstimate(JSON.parse(saved));
      return;
    }
    setEstimate(getDefaultEstimateData());
  }, []);

  const handleSave = () => {
    if (!estimate) return;
    localStorage.setItem('estimate-data', JSON.stringify(estimate));
    alert('저장되었습니다!');
  };

  const previewRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    if (!previewRef.current || !estimate) return;
    setIsExporting(true);
    setLastExport('pdf');
    const { toPng } = await import('html-to-image');
    const { jsPDF } = await import('jspdf');
    const dataUrl = await toPng(previewRef.current, { quality: 0.95 });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const imgProps = pdf.getImageProperties(dataUrl);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
    const fileName = (estimate.fileName ?? '').trim() || `estimate-${estimate.estimateNumber}`;
    pdf.save(`${fileName}.pdf`);
    setIsExporting(false);
  };

  const handleExportImage = async () => {
    if (!previewRef.current || !estimate) return;
    setIsExporting(true);
    setLastExport('png');
    const { toPng } = await import('html-to-image');
    const dataUrl = await toPng(previewRef.current, { quality: 0.95 });
    const link = document.createElement('a');
    const fileName = (estimate.fileName ?? '').trim() || `estimate-${estimate.estimateNumber}`;
    link.download = `${fileName}.png`;
    link.href = dataUrl;
    link.click();
    setIsExporting(false);
  };

  const updateSender = (field: keyof EstimateData['sender'], value: string) => {
    setEstimate(prev => {
      if (!prev) return prev;
      return { ...prev, sender: { ...prev.sender, [field]: value } };
    });
  };

  const updateMeta = (field: 'title' | 'fileName' | 'fontFamily', value: string | number) => {
    setEstimate(prev => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
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
  const tax = calculateTax(subtotal, estimate.taxRate);
  const total = calculateTotal(subtotal, tax);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div data-export-status={lastExport ?? ''} className="sr-only" />
      <div className="flex h-screen">
        <div className="w-[40%] bg-white border-r border-gray-200 overflow-y-auto shadow-sm">
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-bold">견적서메이커</h1>
              <button className="px-4 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200">
                로그인
              </button>
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
                placeholder="저장 파일명"
              />
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
                        className="w-20 px-3 py-2 border rounded text-sm"
                        placeholder="수량"
                      />
                      <input
                        type="number"
                        value={item.unitPrice ?? 0}
                        onChange={(e) => updateItem(item.id, 'unitPrice', parseInt(e.target.value) || 0)}
                        className="w-28 px-3 py-2 border rounded text-sm"
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
                <div className="mt-3">
                  <label className="text-xs text-slate-500">부가세율(%)</label>
                  <input
                      type="number"
                      value={Math.round((estimate.taxRate ?? 0) * 100)}
                      onChange={(e) => {
                        const rate = Number(e.target.value);
                        setEstimate(prev => (prev ? { ...prev, taxRate: rate / 100 } : prev));
                      }}
                      className="mt-1 w-24 px-3 py-2 border rounded text-sm"
                    />
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

        <div className="w-[60%] bg-slate-100 overflow-y-auto p-8">
          <div
            ref={previewRef}
            data-preview="true"
            className="bg-white shadow-lg max-w-3xl mx-auto p-12 min-h-[800px] rounded-xl"
            style={{ fontFamily: fontOptions.find(option => option.value === estimate.fontFamily)?.stack }}
          >
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
                  <h1 className="text-3xl font-bold mb-2">견적서</h1>
                  <p className="text-gray-600">NO. {estimate.estimateNumber}</p>
                </div>
                <div className="text-right text-sm text-gray-600">
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
                    <td className="text-right py-3">{formatKRW(item.total)}</td>
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
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">부가세 (10%)</span>
                  <span>{formatKRW(tax)}</span>
                </div>
                <div className="flex justify-between py-3 border-t-2 border-gray-800 font-bold text-lg">
                  <span className="text-blue-600">총계</span>
                  <span className="text-blue-600">{formatKRW(total)}</span>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-2">계좌 정보 (PAYMENT INFO)</p>
              <p className="font-medium">{estimate.paymentInfo.bankName} | {estimate.paymentInfo.accountNumber}</p>
              <p className="text-sm text-gray-600">예금주: {estimate.paymentInfo.accountHolder}</p>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-2">비고 (NOTES)</p>
              <p className="text-sm">{estimate.notes}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-2">이용 약관 (TERMS & CONDITIONS)</p>
              <p className="text-sm">{estimate.terms}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
