import { AboutFabricVideo } from './AboutFabricVideo';

/** S3 */
export function AboutFabric() {
  return (
    <section className="av3-fabric" aria-labelledby="about-s3">
      <AboutFabricVideo />
      <div className="av3-wrap av3-fabric-copy">
        <p className="av3-eyebrow">کیفیت پارچه</p>
        <h2 id="about-s3" className="reveal">
          پارچه‌های ترنم در هر فصل: دورس، کتون و مموری در پاییز و زمستان، لینن در تابستان
        </h2>
        <div className="av3-seasons">
          <div className="reveal">
            <h3>پاییز و زمستان (فصل جاری)</h3>
            <ul>
              <li>
                <b>دورس ۳ نخ</b>
              </li>
              <li>
                <b>کتون ۴۵۰ گرم</b>
              </li>
              <li>
                <b>پارچهٔ مموری لایکودوزی‌شده</b> برای کاپشن‌ها
              </li>
            </ul>
          </div>
          <div className="reveal">
            <h3>تابستان</h3>
            <p className="av3-body">
              بیشتر <b>لینن</b>؛ سبک و خنک برای آب‌وهوای ایران.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
