import { Mail, MessageSquare, Phone } from 'lucide-react';

export default function ContactPage() {
    return (
        <div className="container mx-auto px-6 py-24">
            <h1 className="text-4xl font-bold text-slate-900 mb-12 text-center">How can we help?</h1>

            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                <ContactCard
                    icon={<MessageSquare className="w-6 h-6" />}
                    title="Live Chat"
                    desc="Chat with our support team M-F, 9am - 5pm EST."
                    action="Start Chat"
                />
                <ContactCard
                    icon={<Mail className="w-6 h-6" />}
                    title="Email Us"
                    desc="For general inquiries and billing questions."
                    action="support@workershive.com"
                />
                <ContactCard
                    icon={<Phone className="w-6 h-6" />}
                    title="Sales"
                    desc="Talk to a specialist about Enterprise plans."
                    action="1-800-HIVE-PRO"
                />
            </div>
        </div>
    );
}

function ContactCard({ icon, title, desc, action }: any) {
    return (
        <div className="p-8 border border-slate-200 rounded-2xl text-center hover:shadow-lg transition">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-900">
                {icon}
            </div>
            <h3 className="font-bold text-lg mb-2">{title}</h3>
            <p className="text-slate-500 mb-6">{desc}</p>
            <button className="text-red-600 font-bold hover:underline">{action}</button>
        </div>
    );
}
