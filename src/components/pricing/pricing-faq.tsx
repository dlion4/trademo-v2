import { Icon } from "@/components/icons";
import { Reveal } from "@/components/landing/reveal";
import type { PricingFaqDTO } from "@/lib/api/types";

interface PricingFaqProps {
  faqs: PricingFaqDTO[];
}

export function PricingFaq({ faqs }: PricingFaqProps) {
  return (
    <section className="section-shell" id="faq">
      <div className="container-xl">
        <Reveal>
          <div className="section-head section-head--center">
            <span className="eyebrow-label">Frequently Asked Questions</span>
            <h2 className="section-head__title">Everything you need to know about pricing &amp; fees</h2>
            <p className="section-head__subtitle">
              Have questions about how pool profit sharing, high-water marks, or wallet distributions work?
              Find direct answers below.
            </p>
          </div>
        </Reveal>

        <div className="faq-grid">
          {faqs.map((faq, index) => (
            <Reveal key={faq.id} delay={index * 60}>
              <details className="faq-item" open={index === 0}>
                <summary className="faq-summary">
                  <span>{faq.question}</span>
                  <Icon name="chevronDown" size={18} />
                </summary>
                <div className="faq-body">
                  <p className="mb-0">{faq.answer}</p>
                </div>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
