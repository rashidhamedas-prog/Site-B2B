const stats = [
  { value: '+۵۰۰', label: 'مشتری عمده‌فروش', sublabel: 'در سراسر ایران' },
  { value: '۱۰+', label: 'سال تجربه', sublabel: 'در بازار پوشاک' },
  { value: '+۵۰', label: 'مدل فعال', sublabel: 'بهار و تابستان' },
  { value: '۱۵', label: 'نفر پرسنل', sublabel: 'در خط تولید' },
];

export function WholesaleStats() {
  return (
    <section className="bg-white border-b border-gray-100">
      <div className="container-site py-10">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-extrabold text-primary">{stat.value}</p>
              <p className="mt-1 text-sm font-semibold text-gray-700">{stat.label}</p>
              <p className="text-xs text-gray-400">{stat.sublabel}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
