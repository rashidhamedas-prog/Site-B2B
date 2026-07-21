import Link from 'next/link';
import { Button } from '@/components/ui';
import { Phone, Send } from 'lucide-react';

export function CtaBanner() {
  return (
    <section className="relative overflow-hidden bg-gradient-brand section">
      <div className="bg-grain absolute inset-0" />
      <div
        className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-secondary/20 blur-3xl"
      />

      <div className="container-site relative text-center">
        <div className="mx-auto max-w-2xl">
          <p className="mb-3 text-sm font-semibold tracking-wide text-secondary-light">شروع همکاری</p>
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            آماده همکاری با ترنم هستید؟
          </h2>
          <p className="mb-10 text-lg leading-relaxed text-white/75">
            همین الان ثبت‌نام کنید و به جمع عمده‌فروشان ما در سراسر ایران بپیوندید، یا با تیم فروش تماس
            بگیرید.
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link href="/portal/register" className="cursor-pointer">
              <Button size="lg" variant="secondary" className="min-w-[180px]">
                ثبت‌نام رایگان
              </Button>
            </Link>

            <a href="tel:09152424624" className="cursor-pointer">
              <Button
                size="lg"
                variant="outline"
                className="min-w-[180px] border-white/50 text-white hover:border-white hover:bg-white hover:text-primary"
                rightIcon={<Phone className="h-5 w-5" />}
              >
                تماس با فروش
              </Button>
            </a>

            <a
              href="https://t.me/toliditaranom"
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer"
            >
              <Button
                size="lg"
                variant="ghost"
                className="min-w-[180px] text-white hover:bg-white/10"
                rightIcon={<Send className="h-5 w-5" />}
              >
                تلگرام
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
