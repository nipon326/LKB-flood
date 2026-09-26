import { NewsItem } from "@/lib/news";

export default function NewsCard({ items }: { items: NewsItem[] }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-md sm:p-6">
      <h2 className="text-2xl font-bold text-gray-900">
        📰 ข่าว &amp; ประกาศเตือนภัยน้ำท่วม กทม.
      </h2>

      {items.length === 0 ? (
        <p className="mt-4 text-gray-500">ยังไม่มีข่าวล่าสุดในขณะนี้</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.link}>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl border border-gray-200 p-4 hover:bg-gray-50"
              >
                <p className="text-lg font-semibold leading-snug text-gray-900">
                  {item.title}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {item.source} • {item.timeAgo}
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}

      <a
        href="https://www.facebook.com/Bangkok.Water"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 block rounded-2xl bg-blue-50 p-4 text-center text-lg font-semibold text-blue-700 hover:bg-blue-100"
      >
        📘 เปิด Facebook สำนักการระบายน้ำ กทม.
      </a>
    </section>
  );
}
