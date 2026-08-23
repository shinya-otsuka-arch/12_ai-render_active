import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Nav } from "@/components/nav";

const features = [
  {
    href: "/render",
    badge: "CG / スケッチ",
    title: "AIパース",
    description:
      "SketchUpやCG・手描きスケッチをアップロードし、構造を保ったまま写実的な建築パースへ変換します。",
    detail: "CG・スケッチ → 写実化",
    icon: "◈",
    color: "text-amber-700",
  },
  {
    href: "/redesign",
    badge: "実写真",
    title: "AIリデザイン",
    description:
      "内観・外観の実写真をアップロードし、壁や窓などの構造を保持したまま素材・色・雰囲気を変更します。",
    detail: "内観・外観の実写真 → デザイン変更",
    icon: "◇",
    color: "text-stone-700",
  },
  {
    href: "/staging",
    badge: "インテリア",
    title: "AIステージング",
    description:
      "空室の写真に家具・インテリアを自動配置。不動産・インテリアのビジュアル提案を短時間で仕上げます。",
    detail: "空室写真 → 家具配置",
    icon: "◉",
    color: "text-stone-600",
  },
  {
    href: "/edit",
    badge: "部分編集",
    title: "AI編集",
    description:
      "画像の一部をブラシで塗るだけで、素材・色・オブジェクトを変更。修正依頼にもすぐ対応できます。",
    detail: "マスク指定 → 部分変更",
    icon: "◌",
    color: "text-zinc-600",
  },
  {
    href: "/enhance",
    badge: "仕上げ",
    title: "AI高品質化",
    description:
      "完成パースや下書きを高解像度・高品質化。創造的なディテール追加から忠実な拡大まで調整できます。",
    detail: "完成パース → 高品質化",
    icon: "◎",
    color: "text-amber-800",
  },
];

const steps = [
  { step: "01", label: "画像をアップロード", desc: "用途に合う入力（CG・実写真・空室など）を選択" },
  { step: "02", label: "パラメータを調整", desc: "用途・照明・素材・強度などをパネルから選択" },
  { step: "03", label: "生成する", desc: "数十秒で結果を確認し、履歴から再表示も可能" },
];

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen">
      <Nav />

      <section className="relative overflow-hidden bg-gradient-to-b from-stone-900 to-stone-800 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-4 bg-white/10 text-white border-white/20">
              社内専用ツール
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl leading-tight">
              建築パースを、<br />
              <span className="text-amber-400">5つの専用モードで。</span>
            </h1>
            <p className="mt-6 text-lg text-stone-300 max-w-2xl">
              CG写実化・実写真のデザイン変更・ステージング・部分編集・高品質化。
              入力の性質に合わせてモードを分け、社内向けに品質を優先した構成です。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/render"
                className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white transition-colors"
              >
                パースを開く
              </Link>
              <Link
                href="/redesign"
                className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium border border-white/30 text-white hover:bg-white/10 transition-colors"
              >
                リデザインを開く
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">5モード構成</h2>
            <p className="mt-3 text-muted-foreground">
              入力と目的ごとに最適なモデル・既定値を使い分けます。
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => (
              <Link key={feature.href} href={feature.href} className="group block">
                <Card className="h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 border-border/60">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <span className={`text-3xl ${feature.color}`}>{feature.icon}</span>
                      <Badge variant="secondary" className="text-xs">{feature.badge}</Badge>
                    </div>
                    <CardTitle className="text-xl mt-3 group-hover:text-primary transition-colors">
                      {feature.title}
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                      {feature.detail}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      {feature.description}
                    </p>
                    <div className="mt-4 flex items-center text-sm font-medium text-primary">
                      開く <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">3ステップで完成</h2>
            <p className="mt-3 text-muted-foreground">モードを選び、パラメータを調整して生成します。</p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold mb-4">
                  {s.step}
                </div>
                <h3 className="text-lg font-semibold mb-2">{s.label}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t bg-background py-8 px-4">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm font-semibold text-primary">AI Render</span>
          <p className="text-xs text-muted-foreground">
            社内専用 · Powered by Replicate / OpenAI
          </p>
        </div>
      </footer>
    </main>
  );
}
