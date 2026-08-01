import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Nav } from "@/components/nav";

const features = [
  {
    href: "/render",
    badge: "メイン機能",
    title: "AIパース生成",
    description:
      "スケッチ・CG・写真をアップロードし、スタイル・照明・素材を選ぶだけ。プロンプト不要でフォトリアルな建築パースを数十秒で生成します。",
    detail: "内観・外観 / 6スタイル / 5ライティング",
    icon: "◈",
    color: "text-amber-700",
  },
  {
    href: "/staging",
    badge: "インテリア",
    title: "AIステージング",
    description:
      "空室の写真に家具・インテリアを自動配置。不動産・インテリアのビジュアル提案を瞬時に仕上げます。",
    detail: "空室写真 → 家具配置 → 即完成",
    icon: "◉",
    color: "text-stone-600",
  },
  {
    href: "/edit",
    badge: "編集",
    title: "AI画像編集",
    description:
      "生成した画像の一部をブラシで塗るだけで、素材・色・オブジェクトを自在に変更。修正依頼にも即座に対応できます。",
    detail: "マスク描画 → テキスト指示 → 部分変更",
    icon: "◌",
    color: "text-zinc-600",
  },
];

const steps = [
  { step: "01", label: "画像をアップロード", desc: "写真・CGパース・スケッチをドラッグ&ドロップ" },
  { step: "02", label: "パラメータを選択", desc: "用途・スタイル・照明・素材をクリックで選ぶだけ" },
  { step: "03", label: "生成ボタンを押す", desc: "約30秒でフォトリアルなレンダリングが完成" },
];

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen">
      <Nav />

      {/* ヒーロー */}
      <section className="relative overflow-hidden bg-gradient-to-b from-stone-900 to-stone-800 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-4 bg-white/10 text-white border-white/20">
              AI建築レンダリング
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl leading-tight">
              想像するだけ、<br />
              <span className="text-amber-400">文字はいらない。</span>
            </h1>
            <p className="mt-6 text-lg text-stone-300 max-w-2xl">
              パラメータを選ぶだけで、誰でも正確に生成指示ができる建築家のためのAIツール。
              長いプロンプトは不要。スタイル・照明・素材をパネルから選択するだけで、
              プロ品質のレンダリングが数十秒で完成します。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/render"
                className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white transition-colors"
              >
                無料で試す
              </Link>
              <Link
                href="/staging"
                className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium border border-white/30 text-white hover:bg-white/10 transition-colors"
              >
                AIステージングを見る
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 機能カード */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">建築・デザインに特化したAIツール</h2>
            <p className="mt-3 text-muted-foreground">パースから編集・ステージングまで。一気通貫のワークフロー。</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
                      試してみる <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 使い方ステップ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">3ステップで完成</h2>
            <p className="mt-3 text-muted-foreground">プロンプトは不要。誰でも直感的に使えます。</p>
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
          <div className="mt-12 text-center">
            <Link
              href="/render"
              className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
            >
              AIパースを試す →
            </Link>
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="mt-auto border-t bg-background py-8 px-4">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm font-semibold text-primary">ArchiRender</span>
          <p className="text-xs text-muted-foreground">
            Powered by Replicate AI · 建築・不動産業務支援ツール
          </p>
        </div>
      </footer>
    </main>
  );
}
