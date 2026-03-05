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

    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const element = previewRef.current;

      // html2canvas로 전체 컨텐츠 캡처 (scale: 2로 고해상도)
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });

      // A4 크기 (mm 단위)
      const pdfWidth = 210;
      const pdfHeight = 297;

      // 캡처된 이미지 크기
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // PDF 생성
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      // 이미지를 PDF 너비에 맞게 스케일
      const ratio = imgWidth / imgHeight;
      const pdfImgWidth = pdfWidth;
      const pdfImgHeight = pdfWidth / ratio;

      // 한 페이지에 들어갈 이미지 높이
      const pageHeight = pdfHeight;

      // 필요한 총 페이지 수 계산
      let heightLeft = pdfImgHeight;
      let position = 0;
      let page = 0;

      // 캔버스를 이미지로 변환
      const imgData = canvas.toDataURL('image/png');

      // 첫 페이지 추가
      pdf.addImage(imgData, 'PNG', 0, position, pdfImgWidth, pdfImgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      // 남은 높이가 있으면 페이지 추가
      while (heightLeft > 0) {
        position = -(pageHeight * (++page));
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfImgWidth, pdfImgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      const fileName = estimate.fileName.trim() || `estimate-${estimate.estimateNumber}`;
      pdf.save(`${fileName}.pdf`);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('PDF 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportImage = async () => {
    if (!previewRef.current || !estimate) return;
    setIsExporting(true);
    setLastExport('png');

    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: previewRef.current.scrollWidth,
        windowHeight: previewRef.current.scrollHeight
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const fileName = estimate.fileName.trim() || `estimate-${estimate.estimateNumber}`;
      link.download = `${fileName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Image export failed:', error);
      alert('이미지 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsExporting(false);
    }
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
                value={estimate.title}
                onChange={(e) => updateMeta('title', e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="견적서 제목"
              />
              <input
                type="text"
                value={estimate.fileName}
                onChange={(e) => updateMeta('fileName', e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="저장 파일명"
              />
              <div>
                <label className="text-xs text-slate-500">폰트</label>
                <select
                  value={estimate.fontFamily}
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
                  value={estimate.sender.name}
                  onChange={(e) => updateSender('name', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="회사명"
                />
                <input
                  type="text"
                  value={estimate.sender.address}
                  onChange={(e) => updateSender('address', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="주소"
                />
                <input
                  type="email"
                  value={estimate.sender.email}
                  onChange={(e) => updateSender('email', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="이메일"
                />
                <input
                  type="tel"
                  value={estimate.sender.phone}
                  onChange={(e) => updateSender('phone', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="전화번호"
                />
                <input
                  type="text"
                  value={estimate.sender.businessNumber}
                  onChange={(e) => updateSender('businessNumber', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="사업자번호"
                />
              </div>

              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <h3 className="font-medium">수신자 (Recipient)</h3>
                <input
                  type="text"
                  value={estimate.recipient.name}
                  onChange={(e) => updateRecipient('name', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="회사명"
                />
                <input
                  type="text"
                  value={estimate.recipient.address}
                  onChange={(e) => updateRecipient('address', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="주소"
                />
                <input
                  type="email"
                  value={estimate.recipient.email}
                  onChange={(e) => updateRecipient('email', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="이메일"
                />
                <input
                  type="tel"
                  value={estimate.recipient.phone}
                  onChange={(e) => updateRecipient('phone', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="전화번호"
                />
              </div>

              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <h3 className="font-medium">계좌 정보 (Payment)</h3>
                <input
                  type="text"
                  value={estimate.paymentInfo.bankName}
                  onChange={(e) => updatePayment('bankName', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="은행명"
                />
                <input
                  type="text"
                  value={estimate.paymentInfo.accountNumber}
                  onChange={(e) => updatePayment('accountNumber', e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="계좌번호"
                />
                <input
                  type="text"
                  value={estimate.paymentInfo.accountHolder}
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
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        className="flex-1 px-3 py-2 border rounded text-sm"
                        placeholder="품목명"
                      />
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                        className="w-20 px-3 py-2 border rounded text-sm"
                        placeholder="수량"
                      />
                      <input
                        type="number"
                        value={item.unitPrice}
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
                    value={Math.round(estimate.taxRate * 100)}
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
                  value={estimate.notes}
                  onChange={(e) => setEstimate(prev => (prev ? { ...prev, notes: e.target.value } : prev))}
                  className="w-full px-3 py-2 border rounded h-20"
                  placeholder="비고사항"
                />
              </div>

              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <h3 className="font-medium">이용 약관 (Terms)</h3>
                <textarea
                  value={estimate.terms}
                  onChange={(e) => setEstimate(prev => (prev ? { ...prev, terms: e.target.value } : prev))}
                  className="w-full px-3 py-2 border rounded h-20"
                  placeholder="이용 약관"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="w-[60%] overflow-y-auto p-8" style={{ background: '#f7f7f7' }}>
          <div
            ref={previewRef}
            data-preview="true"
            className="bg-white mx-auto estimate-preview"
            style={{
              fontFamily: fontOptions.find(option => option.value === estimate.fontFamily)?.stack,
              width: '210mm',
              maxWidth: '210mm',
              padding: '48px 40px',
              boxSizing: 'border-box',
              overflow: 'visible',
              color: '#000000',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div className="mb-12">
              <div className="flex justify-between items-start mb-12">
                <div>
                  <h1 className="text-3xl font-semibold mb-3" style={{ color: '#000000', letterSpacing: '-0.02em' }}>Invoice</h1>
                  <p className="text-sm" style={{ color: '#666666' }}>{estimate.sender.name}</p>
                  {estimate.logoDataUrl && (
                    <img
                      src={estimate.logoDataUrl}
                      alt="로고"
                      className="mt-3 h-10 object-contain"
                      style={{ maxWidth: '120px' }}
                    />
                  )}
                </div>
                <div className="text-right text-sm" style={{ color: '#666666', lineHeight: '1.8' }}>
                  <p><span style={{ color: '#999' }}>Invoice to:</span> {estimate.recipient.name}</p>
                  <p><span style={{ color: '#999' }}>Invoice ID:</span> {estimate.estimateNumber}</p>
                  <p><span style={{ color: '#999' }}>Date of issue:</span> {estimate.issueDate}</p>
                  <p><span style={{ color: '#999' }}>Payment due:</span> {estimate.dueDate}</p>
                </div>
              </div>

              <div className="text-sm mb-8" style={{ color: '#666', lineHeight: '1.8' }}>
                <p><span style={{ color: '#999' }}>ABN:</span> {estimate.sender.businessNumber}</p>
                <p><span style={{ color: '#999' }}>Email:</span> {estimate.sender.email}</p>
                <p><span style={{ color: '#999' }}>Phone:</span> {estimate.sender.phone}</p>
                <p><span style={{ color: '#999' }}>Address:</span> {estimate.sender.address}</p>
              </div>
            </div>

            <div className="mb-10">
              <h2 className="text-base font-semibold mb-4" style={{ color: '#000000' }}>Description of services</h2>
              <table className="w-full" style={{ fontSize: '14px' }}>
                <thead>
                  <tr className="text-sm" style={{ color: '#999999' }}>
                    <th className="text-left py-3 font-normal">Description</th>
                    <th className="text-center py-3 font-normal w-24">Quantity</th>
                    <th className="text-right py-3 font-normal w-28">Unit price</th>
                    <th className="text-right py-3 font-normal w-28">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {estimate.items.map((item, index) => (
                    <tr key={item.id}>
                      <td className="py-3" style={{ color: '#000000' }}>{item.description}</td>
                      <td className="text-center py-3" style={{ color: '#666666' }}>{item.quantity}</td>
                      <td className="text-right py-3" style={{ color: '#666666' }}>{formatKRW(item.unitPrice)}</td>
                      <td className="text-right py-3 font-medium" style={{ color: '#000000' }}>{formatKRW(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mb-12 pt-6" style={{ borderTop: '1px solid #e5e5e5' }}>
              <div className="w-96">
                <div className="flex justify-between py-2 text-sm">
                  <span style={{ color: '#999999' }}>Subtotal</span>
                  <span style={{ color: '#000000' }}>{formatKRW(subtotal)}</span>
                </div>
                <div className="flex justify-between py-2 text-sm">
                  <span style={{ color: '#999999' }}>Tax ({Math.round(estimate.taxRate * 100)}%)</span>
                  <span style={{ color: '#000000' }}>{formatKRW(tax)}</span>
                </div>
                <div className="flex justify-between items-center pt-4 mt-2" style={{ borderTop: '1px solid #e5e5e5' }}>
                  <span className="text-sm font-medium" style={{ color: '#000000' }}>Total amount due:</span>
                  <span className="text-3xl font-semibold" style={{ color: '#000000' }}>{formatKRW(total)}</span>
                </div>
              </div>
            </div>

            <div className="pt-6" style={{ borderTop: '1px solid #e5e5e5' }}>
              <p className="text-sm font-semibold mb-3" style={{ color: '#000000' }}>Bank details for payment:</p>
              <div className="text-sm" style={{ color: '#666666', lineHeight: '1.8' }}>
                <p><span style={{ color: '#999' }}>Bank:</span> {estimate.paymentInfo.bankName}</p>
                <p><span style={{ color: '#999' }}>BSB:</span> 231-531</p>
                <p><span style={{ color: '#999' }}>Account number:</span> {estimate.paymentInfo.accountNumber}</p>
                <p><span style={{ color: '#999' }}>Name:</span> {estimate.paymentInfo.accountHolder}</p>
              </div>
            </div>

            {estimate.notes && (
              <div className="mt-8 text-sm" style={{ color: '#666666' }}>
                <p className="font-semibold mb-2" style={{ color: '#000000' }}>Notes:</p>
                <p>{estimate.notes}</p>
              </div>
            )}

            {estimate.terms && (
              <div className="mt-6 text-sm" style={{ color: '#666666' }}>
                <p className="font-semibold mb-2" style={{ color: '#000000' }}>Terms:</p>
                <p>{estimate.terms}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
