package com.clases;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

public class CuotasWidgetProvider extends AppWidgetProvider {

    public static final String PREFS_NAME = "cuotas_widget";
    public static final String KEY_DATA = "cuotas_data";

    private static final int MAX_ROWS = 4;

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            actualizarWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private void actualizarWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_cuotas);

        // Al tocar el widget se abre la app
        Intent abrir = new Intent(context, MainActivity.class);
        PendingIntent pending = PendingIntent.getActivity(
                context,
                0,
                abrir,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, pending);

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String json = prefs.getString(KEY_DATA, null);

        List<Item> vencidas = new ArrayList<>();
        List<Item> hoy = new ArrayList<>();
        List<Item> proximas = new ArrayList<>();
        String actualizado = "";

        if (json != null && !json.isEmpty()) {
            try {
                JSONObject data = new JSONObject(json);
                actualizado = data.optString("actualizado", "");
                JSONArray alumnos = data.optJSONArray("alumnos");
                if (alumnos != null) {
                    Calendar calendario = Calendar.getInstance();
                    int mesActual = calendario.get(Calendar.MONTH);
                    int anioActual = calendario.get(Calendar.YEAR);
                    int ultimoDiaMes = calendario.getActualMaximum(Calendar.DAY_OF_MONTH);
                    long hoyInicio = inicioDelDia(calendario).getTimeInMillis();

                    for (int i = 0; i < alumnos.length(); i++) {
                        JSONObject a = alumnos.getJSONObject(i);
                        boolean pagado = a.optBoolean("pagoMesActual", false);
                        if (pagado) continue;

                        Item item = new Item();
                        item.nombre = a.optString("nombre", "");
                        item.apellido = a.optString("apellido", "");
                        item.monto = a.optString("monto", "");

                        int diaVencimiento = Math.min(a.optInt("diaEntrada", 1), ultimoDiaMes);
                        Calendar venc = Calendar.getInstance();
                        venc.set(anioActual, mesActual, diaVencimiento, 0, 0, 0);
                        venc.set(Calendar.MILLISECOND, 0);
                        long diffMs = venc.getTimeInMillis() - hoyInicio;
                        int diffDias = (int) (diffMs / (1000 * 60 * 60 * 24));

                        item.dias = Math.abs(diffDias);
                        if (diffDias < 0) {
                            item.vencida = true;
                            vencidas.add(item);
                        } else if (diffDias == 0) {
                            hoy.add(item);
                        } else {
                            proximas.add(item);
                        }
                    }
                }
            } catch (Exception e) {
                // Datos inválidos: se muestra el estado vacío
            }
        }

        // Vencidas primero (más días primero), luego vence hoy y las próximas para llenar filas
        vencidas.sort((x, y) -> Integer.compare(y.dias, x.dias));
        proximas.sort((x, y) -> Integer.compare(x.dias, y.dias));

        List<Item> filas = new ArrayList<>(vencidas);
        filas.addAll(hoy);
        filas.addAll(proximas);

        int totalVencidas = vencidas.size();
        views.setTextViewText(R.id.tv_count, String.valueOf(totalVencidas));
        views.setTextViewText(R.id.tv_title, totalVencidas == 1 ? "Cuota vencida" : "Cuotas vencidas");

        for (int i = 0; i < MAX_ROWS; i++) {
            int resId = filaId(i);
            if (i < filas.size()) {
                views.setViewVisibility(resId, View.VISIBLE);
                views.setTextViewText(resId, filas.get(i).texto());
            } else {
                views.setViewVisibility(resId, View.GONE);
            }
        }

        int restantes = filas.size() - MAX_ROWS;
        if (restantes > 0) {
            views.setViewVisibility(R.id.tv_more, View.VISIBLE);
            views.setTextViewText(R.id.tv_more, "+" + restantes + " más");
        } else {
            views.setViewVisibility(R.id.tv_more, View.GONE);
        }

        boolean hayFilas = !filas.isEmpty();
        views.setViewVisibility(R.id.tv_empty, hayFilas ? View.GONE : View.VISIBLE);
        views.setTextViewText(R.id.tv_empty, totalVencidas == 0 ? "¡Todos al día! 🎉" : "Abrí la app para ver las cuotas");

        // Pie: resumen de hoy/próximas + hora de actualización
        String pie = "";
        if (totalVencidas > 0) pie += totalVencidas + (totalVencidas == 1 ? " vencida" : " vencidas");
        if (!hoy.isEmpty()) pie += (pie.isEmpty() ? "" : "  ·  ") + hoy.size() + (hoy.size() == 1 ? " hoy" : " hoy");
        if (!proximas.isEmpty()) pie += (pie.isEmpty() ? "" : "  ·  ") + proximas.size() + (proximas.size() == 1 ? " próxima" : " próximas");
        if (!actualizado.isEmpty()) pie += (pie.isEmpty() ? "" : "  ·  ") + "act. " + actualizado;

        views.setTextViewText(R.id.tv_footer, pie.isEmpty() ? "Tocá para abrir la app" : pie);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static Calendar inicioDelDia(Calendar cal) {
        Calendar inicio = (Calendar) cal.clone();
        inicio.set(Calendar.HOUR_OF_DAY, 0);
        inicio.set(Calendar.MINUTE, 0);
        inicio.set(Calendar.SECOND, 0);
        inicio.set(Calendar.MILLISECOND, 0);
        return inicio;
    }

    private static int filaId(int i) {
        switch (i) {
            case 0: return R.id.row_1;
            case 1: return R.id.row_2;
            case 2: return R.id.row_3;
            default: return R.id.row_4;
        }
    }

    private static class Item {
        String nombre;
        String apellido;
        int dias;      // días vencido (vencida) o días que faltan (próxima)
        boolean vencida;
        String monto;

        String texto() {
            StringBuilder sb = new StringBuilder();
            sb.append(nombre);
            if (apellido != null && !apellido.isEmpty()) sb.append(" ").append(apellido);
            if (monto != null && !monto.isEmpty()) sb.append(" · $").append(monto);
            if (dias == 0) {
                sb.append(" · vence hoy");
            } else if (vencida) {
                sb.append(" · hace ").append(dias).append(dias == 1 ? " día" : " días");
            } else {
                sb.append(" · faltan ").append(dias).append(dias == 1 ? " día" : " días");
            }
            return sb.toString();
        }
    }
}
