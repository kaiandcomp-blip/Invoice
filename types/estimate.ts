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

export const generateEstimateNumber = (): string => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INV-${year}-${random}`;
};

export const getDefaultEstimateData = (): EstimateData => ({
  estimateNumber: generateEstimateNumber(),
  issueDate: new Date().toISOString().split('T')[0],
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  sender: {
    name: '견적서메이커',
    address: '서울특별시 강남구 테헤란로 123',
    email: 'contact@quote-maker.cx',
    phone: '02-1234-5678',
    businessNumber: '123-45-67890',
  },
  recipient: {
    name: '스타트업 주식회사',
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
});
