import Link from 'next/link';
import { Button } from '@/components/ui';
import { Phone, Send } from 'lucide-react';

export function CtaBanner() {
  return (
    <section className="section bg-gradient-brand">
      <div className="container-site text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            آماده همکاری با ترنم هستید؟
          </h2>
          <p className="text-lg text-white/80 mb-8 leading-relaxed">
            همین الان ثبت‌نام کنید و به جمع صدها عمده‌فروش ما در سراسر ایران بپیوندید.
            یا با تیم فروش تماس بگیرید.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/portal/register">
              <Button
                size="lg"
                variant="secondary"
                className="min-w-[180px]"
              >
                ثبت‌نام رایگان
              </Button>
            </Link>

            <a href="tel:09152424624">
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white hover:text-primary min-w-[180px]"
                rightIcon={<Phone className="h-5 w-5" />}
              >
                تماس با فروش
              </Button>
            </a>

            <a
              href="https://t.me/toliditaranom"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                size="lg"
                variant="ghost"
                className="text-white hover:bg-white/10 min-w-[180px]"
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
