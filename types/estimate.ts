export interface Sender {
  name: string;
  address: string;
  email: string;
  phone: string;
  businessNumber: string;
}

export interface Recipient {
  name: string;
  address: string;
  email: string;
  phone: string;
}

export interface PaymentInfo {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface EstimateData {
  title: string;
  fileName: string;
  fontFamily: string;
  logoDataUrl: string | null;
  estimateNumber: string;
  issueDate: string;
  dueDate: string;
  sender: Sender;
  recipient: Recipient;
  paymentInfo: PaymentInfo;
  items: LineItem[];
  notes: string;
  terms: string;
  taxRate: number;
  discountRate: number; // Global discount percentage (0-100)
  savePath: string;
  designTemplate: 'design1' | 'design2' | 'design3' | 'design4';
}

export const calculateSubtotal = (items: LineItem[]): number => {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
};

export const calculateTax = (subtotal: number, taxRate: number = 0.1): number => {
  return Math.round(subtotal * taxRate);
};

export const calculateTotal = (subtotal: number, tax: number): number => {
  return subtotal + tax;
};

export const formatKRW = (amount: number): string => {
  return '₩' + amount.toLocaleString('ko-KR');
};

export const generateEstimateNumber = (sequence: number = 1): string => {
  const year = new Date().getFullYear();
  const seqStr = sequence.toString().padStart(3, '0');
  return `INV-${year}-${seqStr}`;
};

export const generateDefaultFileName = (title: string, date: string, sequence: number = 1): string => {
  const safeTitle = (title || '견적서').replace(/[\\/:*?"<>|]/g, '_').substring(0, 20);
  const safeDate = date || new Date().toLocaleDateString('en-CA');
  const seqStr = sequence.toString().padStart(3, '0');
  return `${safeTitle}_${safeDate}_${seqStr}`;
};

export const getDefaultEstimateData = (): EstimateData => {
  const estimateNumber = generateEstimateNumber();

  return {
    title: '[카이앤컴퍼니] 마케팅 견적서',
    fileName: '', // Will be computed if empty
    fontFamily: 'system',
    logoDataUrl: null,
    estimateNumber,
    issueDate: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD in local time
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA'),
    sender: {
      name: '카이앤컴퍼니',
      address: '서울특별시 강남구 테헤란로 123',
      email: 'contact@quote-maker.cx',
      phone: '02-1234-5678',
      businessNumber: '123-45-67890',
    },
    recipient: {
      name: '스타트업(주)',
      address: '서울특별시 중구, 110022',
      email: 'ceo@startup-kr.com',
      phone: '010-9876-5432',
    },
    paymentInfo: {
      bankName: '00은행',
      accountNumber: '1234-56-7890',
      accountHolder: '홍길동',
    },
    items: [
      {
        id: '1',
        description: '웹사이트 UI/UX 디자인',
        quantity: 1,
        unitPrice: 1500000,
        total: 1500000,
      },
      {
        id: '2',
        description: '프론트엔드 개발 (React)',
        quantity: 1,
        unitPrice: 2000000,
        total: 2000000,
      },
      {
        id: '3',
        description: '백엔드 API 연동',
        quantity: 1,
        unitPrice: 1000000,
        total: 1000000,
      },
    ],
    notes: '본 견적서는 2주간 유효합니다.',
    terms: '착수금 50%, 잔금 50% (완료 후 7일 이내 지급)',
    taxRate: 0.1,
    discountRate: 0,
    savePath: '',
    designTemplate: 'design1',
  };
};
