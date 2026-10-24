"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatDateCourte, formatPrix } from "@/lib/utils"

const euroCompact = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
})

const AXE = { fill: "var(--viz-discret)", fontSize: 12 }

interface PointJour {
  date: string
  nb: number
  ht: number
  ttc: number
}

interface InfobulleProps {
  active?: boolean
  payload?: { payload: { titre: string; nb: number; ht: number; ttc: number } }[]
}

/** Valeur d'abord (forte), libellé ensuite. */
function Infobulle({ active, payload }: InfobulleProps) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <div className="text-base font-semibold tabular-nums">{formatPrix(p.ttc)} TTC</div>
      <div className="text-muted-foreground first-letter:uppercase">{p.titre}</div>
      <div className="text-xs text-muted-foreground tabular-nums">
        {formatPrix(p.ht)} HT · {p.nb} commande{p.nb > 1 ? "s" : ""}
      </div>
    </div>
  )
}

/** CA TTC par jour : colonnes fines, une seule série, valeur du dernier jour sur le chapeau. */
export function GraphiqueCAJours({ donnees }: { donnees: PointJour[] }) {
  const data = donnees.map((d) => ({ ...d, titre: formatDateCourte(d.date) }))
  const dernier = data.length - 1

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--viz-grille)" />
        <XAxis
          dataKey="titre"
          tick={AXE}
          tickLine={false}
          axisLine={{ stroke: "var(--viz-axe)" }}
          interval={0}
        />
        <YAxis
          tick={AXE}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v: number) => euroCompact.format(v)}
        />
        <Tooltip content={<Infobulle />} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
        <Bar dataKey="ttc" fill="var(--viz-serie-1)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
          <LabelList
            dataKey="ttc"
            position="top"
            content={(props) => {
              const { x, y, width, value, index } = props as {
                x: number
                y: number
                width: number
                value: number
                index: number
              }
              if (index !== dernier || !value) return null
              return (
                <text
                  x={x + width / 2}
                  y={y - 8}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={600}
                  fill="var(--foreground)"
                >
                  {euroCompact.format(value)}
                </text>
              )
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

interface PointPdv {
  nom: string
  nb: number
  ht: number
  ttc: number
}

/** CA par point de vente : barres horizontales, une seule couleur, valeur au bout. */
export function GraphiqueCAPointsDeVente({ donnees }: { donnees: PointPdv[] }) {
  const data = donnees.map((d) => ({ ...d, titre: d.nom }))
  const hauteur = Math.max(140, data.length * 52 + 24)

  return (
    <ResponsiveContainer width="100%" height={hauteur}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 88, bottom: 8, left: 0 }}>
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis
          type="category"
          dataKey="titre"
          tick={{ ...AXE, fill: "var(--foreground)", fontSize: 13 }}
          tickLine={false}
          axisLine={{ stroke: "var(--viz-axe)" }}
          width={120}
        />
        <Tooltip content={<Infobulle />} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
        <Bar dataKey="ttc" fill="var(--viz-serie-1)" radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false}>
          <LabelList
            dataKey="ttc"
            content={(props) => {
              const { x, y, width, height, value } = props as {
                x: number
                y: number
                width: number
                height: number
                value: number
              }
              return (
                <text
                  x={x + (width || 0) + 8}
                  y={y + height / 2}
                  dominantBaseline="central"
                  fontSize={13}
                  fontWeight={600}
                  fill={value ? "var(--foreground)" : "var(--muted-foreground)"}
                >
                  {formatPrix(Number(value))}
                </text>
              )
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
