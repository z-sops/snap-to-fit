import { TrendChart } from "../components/visuals";
import { readingTrend } from "../core/chart-data";
import React from "react";
import { Image } from "react-native";
import { router } from "expo-router";
import {
  Screen,
  Card,
  H,
  P,
  Row,
  Metric,
  Button,
  Progress,
  act,
} from "../components/ui";
import { useStore } from "../services/store";
import { weightProjection } from "../core/nutrition";
import { pickPhoto } from "../services/photos";
import { waistRatio, plateauReview } from "../core/trends";
import { uid } from "../core/model";
export default function Journey() {
  const { state, update } = useStore();
  const p = state.profile!;
  const weights = state.readings.filter((r) => r.kind === "weight");
  const start = weights[0]?.value ?? p.weight;
  const current = weights.at(-1)?.value ?? p.weight;
  const projection = weightProjection({ ...p, weight: current });
  const change = current - start;
  const waist = state.readings.filter((r) => r.kind === "waist").at(-1);
  const ratio = waist ? waistRatio(p.height, waist.value) : null;
  const review = plateauReview(state.readings);
  return (
    <Screen
      title="Your journey."
      subtitle="Track the trend. Celebrate the consistency."
    >
      <Card tint>
        <Row>
          <Metric label="Starting" value={start} unit="kg" />
          <Metric label="Latest" value={current} unit="kg" />
          <Metric label="Target" value={p.targetWeight} unit="kg" />
        </Row>
        <Progress
          value={Math.abs(current - start)}
          total={Math.max(0.1, Math.abs(start - p.targetWeight))}
        />
        <P>
          Recorded change: {change > 0 ? "+" : ""}
          {change.toFixed(1)} kg. Weight changes include water, fat and muscle.
        </P>
      </Card>
      <Card>
        <H>Planning window</H>
        {projection ? (
          <P>
            Approximately {projection.minWeeks}–{projection.maxWeeks} weeks at
            an assumed 0.25–0.5 kg/week change. {projection.label}
          </P>
        ) : (
          <P>
            No automatic timeline for your current goal or health context. Your
            logs remain available.
          </P>
        )}
        <Button
          title="Record weight or waist"
          onPress={() => router.push("/health")}
        />
      </Card>
      <Card>
        <H>Waist-to-height tracking</H>
        <Metric label="Waist / height" value={ratio ?? "—"} />
        <P>
          {waist
            ? `Latest waist: ${waist.value} cm. `
            : "Add a waist measurement in Health. "}
          This ratio is a screening measure, not a visceral-fat level or
          diagnosis.
        </P>
      </Card>
      <Card>
        <H>Weight-trend review</H>
        <P>{review.message}</P>
      </Card>
      <Card>
        <H>Weight history</H>
        <TrendChart
          points={readingTrend(state.readings, "weight", "kg")}
          label="Weight"
          unit="kg"
        />
        {weights.map((r) => (
          <P key={r.id}>
            {new Date(r.at).toLocaleDateString()} · {r.value} kg
          </P>
        ))}
      </Card>
      <Card>
        <H>Private progress photos</H>
        <P>
          Saved belly/body-photo copies use the encrypted native device database.
          Selection/processing may leave temporary files; originals can remain
          in your photo library. Progress-photo records are excluded from cloud
          backups and food-analysis requests. We do
          not estimate visceral fat or body-fat percentage from them.
        </P>
        <Button
          title="Add progress photo"
          onPress={() =>
            act(async () => {
              const img = await pickPhoto(false);
              if (img)
                await update((s) => ({
                  ...s,
                  photos: [
                    ...(s.photos || []),
                    { id: uid(), at: new Date().toISOString(), image: img.uri },
                  ],
                }));
            })
          }
        />
        {(state.photos || []).map((photo) => (
          <Card key={photo.id}>
            <Image
              source={{ uri: photo.image }}
              style={{ height: 260, borderRadius: 16 }}
              resizeMode="contain"
            />
            <P>{new Date(photo.at).toLocaleDateString()}</P>
            <Button
              secondary
              title="Delete photo"
              onPress={() =>
                act(() =>
                  update((s) => ({
                    ...s,
                    photos: s.photos.filter((x) => x.id !== photo.id),
                  })),
                )
              }
            />
          </Card>
        ))}
      </Card>
    </Screen>
  );
}
