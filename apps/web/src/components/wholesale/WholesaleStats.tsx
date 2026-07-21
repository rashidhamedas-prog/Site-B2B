const stats = [
  { value: '+۵۰۰', label: 'مشتری عمده‌فروش', sublabel: 'در سراسر ایران' },
  { value: '۱۰+', label: 'سال تجربه', sublabel: 'در بازار پوشاک' },
  { value: '+۵۰', label: 'مدل فعال', sublabel: 'بهار و تابستان' },
  { value: '۱۵', label: 'نفر پرسنل', sublabel: 'در خط تولید' },
];

export function WholesaleStats() {
  return (
    <section className="border-b border-[color:var(--color-border)] bg-white">
      <div className="container-site py-12 sm:py-14">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4 lg:gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center lg:border-l lg:border-[color:var(--color-border)] lg:last:border-l-0 lg:first:border-l-0">
              <p className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">{stat.value}</p>
              <p className="mt-2 text-sm font-semibold text-gray-800">{stat.label}</p>
              <p className="mt-0.5 text-xs text-gray-400">{stat.sublabel}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
