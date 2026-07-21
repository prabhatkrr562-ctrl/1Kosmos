from collections import defaultdict


def _movement_parts(record, month):
    parts = {'new': 0.0, 'upsell': 0.0, 'churn': 0.0, 'downsell': 0.0, 'renewal': 0.0}
    raw = (record.monthly_changes or {}).get(month) or {}
    for label, value in raw.items():
        amount = float(value or 0)
        key = str(label or '').strip().lower()
        if key == 'new':
            parts['new'] += max(0.0, amount)
        elif key == 'upsell':
            parts['upsell'] += max(0.0, amount)
        elif key == 'renewal':
            parts['renewal'] += amount
        elif key == 'churn':
            parts['churn'] += abs(amount) if amount < 0 else 0.0
        elif key == 'downsell':
            parts['downsell'] += abs(amount) if amount < 0 else 0.0
    return parts


def _diff_parts(record, prev_m, curr_m):
    monthly = record.monthly_arr or {}
    curr = float(monthly.get(curr_m) or 0)
    prev = float(monthly.get(prev_m) or 0)
    if prev == 0 and curr > 0:
        return {'new': curr, 'upsell': 0.0, 'churn': 0.0, 'downsell': 0.0, 'renewal': 0.0}
    if prev > 0 and curr == 0:
        return {'new': 0.0, 'upsell': 0.0, 'churn': prev, 'downsell': 0.0, 'renewal': 0.0}
    if curr > prev:
        return {'new': 0.0, 'upsell': curr - prev, 'churn': 0.0, 'downsell': 0.0, 'renewal': 0.0}
    if curr < prev:
        return {'new': 0.0, 'upsell': 0.0, 'churn': 0.0, 'downsell': prev - curr, 'renewal': 0.0}
    return {'new': 0.0, 'upsell': 0.0, 'churn': 0.0, 'downsell': 0.0, 'renewal': curr if curr else 0.0}


def _record_parts(record, month, prev_m=''):
    if (record.monthly_changes or {}).get(month):
        return _movement_parts(record, month)
    return _diff_parts(record, prev_m, month) if prev_m else {
        'new': 0.0, 'upsell': 0.0, 'churn': 0.0, 'downsell': 0.0, 'renewal': 0.0
    }


def _compute_ltm(records):
    if not records:
        return {
            'new_arr': 0, 'upsell': 0, 'churn': 0, 'downsell': 0,
            'opening_arr': 0, 'grr': 100.0, 'nrr': 100.0,
            'growth_pct': 0.0, 'ltm_change': 0,
        }
    latest_month = ''
    for record in records:
        for month in (record.monthly_arr or {}).keys():
            if month > latest_month:
                latest_month = month
    if not latest_month:
        return {
            'new_arr': 0, 'upsell': 0, 'churn': 0, 'downsell': 0,
            'opening_arr': 0, 'grr': 100.0, 'nrr': 100.0,
            'growth_pct': 0.0, 'ltm_change': 0,
        }
    y = int(latest_month[:4])
    ltm_start = f'{y - 1:04d}-12'
    new_arr = upsell = churn = downsell = opening = 0.0
    months = sorted({m for record in records for m in (record.monthly_arr or {}).keys()})
    period_months = [m for m in months if ltm_start < m <= latest_month]
    has_explicit_changes = any(record.monthly_changes for record in records)
    for record in records:
        monthly = record.monthly_arr or {}
        curr = float(monthly.get(latest_month) or 0)
        prev = float(monthly.get(ltm_start) or 0)
        opening += prev
        if not has_explicit_changes:
            if prev == 0 and curr > 0:
                new_arr += curr
            elif prev > 0 and curr == 0:
                churn += prev
            elif curr > prev:
                upsell += curr - prev
            elif curr < prev:
                downsell += prev - curr
    if has_explicit_changes:
        signed = defaultdict(float)
        for record in records:
            for month in period_months:
                for label, value in ((record.monthly_changes or {}).get(month) or {}).items():
                    signed[str(label or '').strip().lower()] += float(value or 0)
        new_arr = max(0.0, signed['new'])
        upsell = max(0.0, signed['upsell'])
        churn = abs(signed['churn']) if signed['churn'] < 0 else 0.0
        downsell = abs(signed['downsell']) if signed['downsell'] < 0 else 0.0
    grr = max(0.0, (opening - churn - downsell) / opening * 100) if opening > 0 else 100.0
    nrr = max(0.0, (opening - churn - downsell + upsell) / opening * 100) if opening > 0 else 100.0
    ltm_change = new_arr + upsell - churn - downsell
    return {
        'new_arr': round(new_arr, 2),
        'upsell': round(upsell, 2),
        'churn': round(churn, 2),
        'downsell': round(downsell, 2),
        'opening_arr': round(opening, 2),
        'grr': round(min(200.0, grr), 1),
        'nrr': round(min(200.0, nrr), 1),
        'growth_pct': round((ltm_change / opening * 100) if opening > 0 else 0.0, 1),
        'ltm_change': round(ltm_change, 2),
    }


def _build_waterfall(records, trend_months):
    result = []
    months = trend_months[-18:]
    has_explicit_changes = any(record.monthly_changes for record in records)
    for i in range(1, len(months)):
        prev_m, curr_m = months[i - 1], months[i]
        w_new = w_up = w_ch = w_dn = 0.0
        if has_explicit_changes:
            signed = defaultdict(float)
            for record in records:
                for label, value in ((record.monthly_changes or {}).get(curr_m) or {}).items():
                    signed[str(label or '').strip().lower()] += float(value or 0)
            w_new = max(0.0, signed['new'])
            w_up = max(0.0, signed['upsell'])
            w_ch = abs(signed['churn']) if signed['churn'] < 0 else 0.0
            w_dn = abs(signed['downsell']) if signed['downsell'] < 0 else 0.0
        else:
            for record in records:
                parts = _diff_parts(record, prev_m, curr_m)
                w_new += parts['new']
                w_up += parts['upsell']
                w_ch += parts['churn']
                w_dn += parts['downsell']
        result.append({
            'month': curr_m,
            'new': round(w_new, 2),
            'upsell': round(w_up, 2),
            'churn': round(w_ch, 2),
            'downsell': round(w_dn, 2),
        })
    return result


def _build_customer_360(records, trend_months):
    latest_month = trend_months[-1] if trend_months else ''
    if latest_month:
        baseline = f'{int(latest_month[:4]) - 1:04d}-12'
        ltm_start = baseline if baseline in trend_months else (trend_months[0] if trend_months else '')
    else:
        ltm_start = ''
    cdata = defaultdict(lambda: {
        'arr': 0.0, 'opening': 0.0, 'contracts': 0,
        'bu': '', 'rep': '', 'products': set(), 'monthly': defaultdict(float),
    })
    for record in records:
        cust = record.end_user or record.bill_to or 'Unspecified'
        cd = cdata[cust]
        cd['arr'] += float((record.monthly_arr or {}).get(latest_month) or 0)
        cd['contracts'] += 1
        if not cd['bu']:
            cd['bu'] = record.business_unit or ''
        if not cd['rep']:
            cd['rep'] = record.sales_person or ''
        if record.sub_product_type:
            cd['products'].add(record.sub_product_type)
        monthly = record.monthly_arr or {}
        if ltm_start:
            cd['opening'] += float(monthly.get(ltm_start) or 0)
        for month, val in monthly.items():
            cd['monthly'][month] += float(val or 0)
    result = []
    for name, cd in sorted(cdata.items(), key=lambda x: x[1]['arr'], reverse=True):
        change = cd['arr'] - cd['opening']
        change_pct = (change / cd['opening'] * 100) if cd['opening'] > 0 else 0.0
        result.append({
            'customer': name,
            'arr': round(cd['arr'], 2),
            'opening_arr': round(cd['opening'], 2),
            'ltm_change': round(change, 2),
            'ltm_change_pct': round(change_pct, 1),
            'contracts': cd['contracts'],
            'bu': cd['bu'],
            'sales_rep': cd['rep'],
            'sub_products': sorted(cd['products']),
            'trend': [
                {'month': m, 'value': round(v, 2)}
                for m, v in sorted(cd['monthly'].items())[-12:]
            ],
        })
    return result
