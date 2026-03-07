import React from 'react';
import { Mail, MessageCircle, Instagram, Music2 } from 'lucide-react';

const CONTACT_ITEMS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    value: '+62 822-7991-0090',
    href: 'https://api.whatsapp.com/send?phone=6282279910090',
    icon: MessageCircle,
  },
  {
    id: 'email',
    label: 'Email',
    value: 'ruangsidigi@gmail.com',
    href: 'mailto:ruangsidigi@gmail.com',
    icon: Mail,
  },
  {
    id: 'instagram',
    label: 'Instagram',
    value: '@studigi.id',
    href: 'https://instagram.com/studigi.id',
    icon: Instagram,
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    value: '@studigi.id',
    href: 'https://www.tiktok.com/@studigi.id',
    icon: Music2,
  },
];

export default function ContactUs() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20 lg:pb-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Contact Us</h2>
        <p className="mt-1 text-sm text-[var(--secondary-color,#69655e)]">
          Hubungi tim Studigi melalui channel berikut.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CONTACT_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.id}
              href={item.href}
              target={item.href.startsWith('mailto:') ? undefined : '_blank'}
              rel={item.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
              className="group rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-[var(--header-color,#103c21)] hover:bg-emerald-50/30"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[var(--header-color,#103c21)]">
                <Icon size={18} />
              </div>
              <p className="text-sm font-semibold text-slate-900">{item.label}</p>
              <p className="mt-1 text-sm text-[var(--secondary-color,#69655e)]">{item.value}</p>
            </a>
          );
        })}
      </section>
    </div>
  );
}
