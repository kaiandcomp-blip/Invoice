import styles from './cover.module.css'

export default function Cover({ searchParams }: { searchParams?: Record<string, string> }) {
  const client = searchParams?.client || '고객명';
  const estimateNo = searchParams?.estimate || 'EST-0001';
  const date = searchParams?.date || new Date().toLocaleDateString('ko-KR');
  const preparedBy = searchParams?.by || '담당자명';
  const total = searchParams?.total || '₩0';

  return (
    <div className={styles.cover}>
      <header className={styles.header}>
        <div className={styles.logo}>Kai &amp; Comp</div>
        <div className={styles.title}>견적서</div>
      </header>

      <main className={styles.main}>
        <h1 className={styles.client}>{client} 님</h1>
        <div className={styles.meta}>
          <div><strong>견적번호</strong>: {estimateNo}</div>
          <div><strong>작성일</strong>: {date}</div>
          <div><strong>총액</strong>: {total}</div>
          <div><strong>작성자</strong>: {preparedBy}</div>
        </div>
      </main>

      <footer className={styles.footer}>문의: hello@kaiandcomp.example</footer>
    </div>
  )
}
