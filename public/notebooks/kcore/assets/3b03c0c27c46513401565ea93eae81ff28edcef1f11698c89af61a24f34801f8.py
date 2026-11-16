import marimo

__generated_with = "0.25.1"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo

    return (mo,)


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    # K-Core Decomposition for Ultramarathon Data

    ## The Sparsity Problem

    Ultramarathon race results present a fascinating modeling challenge. With thousands of races and hundreds of thousands of runners, you might think we'd have plenty of data—but the reality is far more complex. Most runners complete only a handful of races, and most races see only a fraction of the broader running population. This creates an extremely **sparse** dataset where direct comparisons between runners or courses are often impossible.

    Imagine trying to compare a runner who only does Western States with someone who only does Leadville. Without shared race participation, we have no common reference point. This sparsity becomes a critical problem when we want to build statistical models that estimate runner abilities or course difficulties.

    **The solution?** Rather than wrestling with the full sparse dataset, we can identify a densely-connected subset where runners and courses have enough overlap for meaningful inference. This is where **k-core decomposition** comes in—a graph-theoretic technique that iteratively prunes nodes until every remaining node meets minimum connectivity requirements.

    In this notebook, we'll:
    1. Explore the space of possible k-core configurations
    2. Visualize the tradeoffs between subset size and density
    3. Select and examine a specific k-core for downstream modeling
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## Setup

    We begin by loading race results from UltraSignup, a comprehensive database of ultramarathon events. The preprocessing pipeline keeps running events with valid course and distance information, including both finishes and DNFs (Did Not Finish). It does not require a race to report DNFs.

    We focus on marathon-distance and longer events (≥42 km), where both finishes and DNFs contribute to the runner-course graph.
    """)
    return


@app.cell
def _():
    from pathlib import Path

    import pandas as pd
    import numpy as np
    import plotly.graph_objects as go
    import igraph as ig

    from utils.data_processing import load_results, process_results
    from utils.kcore_subsetting import evaluate_all_kcore_candidates, subset_kcore_data

    return (
        Path,
        evaluate_all_kcore_candidates,
        go,
        ig,
        load_results,
        np,
        pd,
        process_results,
        subset_kcore_data,
    )


@app.cell
def _(load_results, process_results):
    # every start (finish or DNF) at marathon distance or longer; the core feeds a
    # finish-time model, so no DNF-reporting filter

    results = process_results(load_results())
    results = results[results['distance_km'] >= 42]
    return (results,)


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    # Exploring the K-Core Parameter Space

    ## What is a (α, β)-Core?

    Think of ultramarathon data as a **bipartite graph**: one set of nodes represents runners, another represents courses (race-distance combinations), and edges connect runners to courses they've started (finished or DNF'd, in any year). Counting DNFs as edges matters: a finishes-only graph would keep runners who rarely drop and lose those who often do, biasing every DNF model downstream. An **(α, β)-core** is the largest subgraph where:

    - Every **runner** has started at least **α** different courses
    - Every **course** has at least **β** different runners

    The parameters α and β control the density-size tradeoff:
    - **Higher α** means runners must have more race history → fewer runners qualify
    - **Higher β** means courses need more participants → fewer courses qualify

    Finding the right balance is crucial. Too loose, and we retain too much sparsity for effective modeling. Too strict, and we throw away valuable data.

    ### Sweeping (α, β)

    Cores are nested: raising α or β only removes runners and courses. So the sweep walks β upward for each α, starting each core from the previous one, and stops when the core is empty. For every configuration it tracks how the subset evolves—measuring not just size, but also **completeness metrics** that indicate how representative the k-core remains of each runner's and course's full history.
    """)
    return


@app.cell
def _(evaluate_all_kcore_candidates, results):
    # search k-core space

    candidates_df = evaluate_all_kcore_candidates(
        results=results,
        max_entities=None,  # cached candidates_df from prior full sweep
        min_alpha=2,  # courses per runner
        min_beta=30,  # runners per course
        beta_step=2,
        verbose=True,
        use_cache=True
    )
    return (candidates_df,)


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    # Visualizing the Parameter Landscape

    The 3D visualization below reveals the fundamental tradeoffs in k-core selection. Each point on the surface represents a different (α, β) configuration:

    - **X-axis (Course Completeness)**: On average, what percentage of each course's total runners are retained in the k-core?
    - **Y-axis (Runner Completeness)**: On average, what percentage of each runner's race history is retained?
    - **Z-axis**: Configurable—toggle between course count, total entities, or total results

    **Key patterns to observe:**
    - The surface drops off sharply as we move toward higher completeness values—achieving both high course and runner completeness simultaneously requires sacrificing dataset size
    - The "ridge" of the surface shows the Pareto frontier: configurations where you can't improve one metric without sacrificing another
    - Hover over points to see the exact (α, β) values and detailed statistics

    Use the toggle buttons to explore different perspectives on the data.
    """)
    return


@app.cell
def _(candidates_df, go, pd, results):
    def plot_3d_kcore_space(candidates_df: pd.DataFrame, full_results: pd.DataFrame=None):
        """
        Create interactive 3D wireframe visualization of k-core parameter space.

        Displays parameter space as a grid wireframe, connecting discrete (α, β) points
        from breadth-first search exploration.

        Args:
            candidates_df: All k-core candidates with metrics
            full_results: Full dataset for calculating baseline density reference planes
        """
        df = candidates_df.copy()
        df['n_entities'] = df['n_courses'] + df['n_participants']
        alpha_values = sorted(df['alpha'].unique())  # Calculate total entities
        beta_values = sorted(df['beta'].unique())
        grid_data = {}
        for _, row in df.iterrows():  # Get unique sorted alpha and beta values
            key = (row['alpha'], row['beta'])
            grid_data[key] = {'x': row['avg_course_completeness'], 'y': row['avg_runner_completeness'], 'z_courses': row['n_courses'], 'z_entities': row['n_entities'], 'z_total_results': row['total_results'], 'n_courses': row['n_courses'], 'n_entities': row['n_entities'], 'total_results': row['total_results'], 'hover': f"α={int(row['alpha'])}, β={int(row['beta'])}<br>Courses: {int(row['n_courses']):,}<br>Runners: {int(row['n_participants']):,}<br>Total Entities: {int(row['n_entities']):,}<br>Total Results: {int(row['total_results']):,}<br>Overall Density: {row['density']:.1f}<br>Runner completeness: {row['avg_runner_completeness']:.1f}%<br>Course completeness: {row['avg_course_completeness']:.1f}%"}
        min_courses = df['n_courses'].min()
        max_courses = df['n_courses'].max()  # Create grid lookup with all z metrics
        min_entities = df['n_entities'].min()
        max_entities = df['n_entities'].max()
        min_results = df['total_results'].min()
        max_results = df['total_results'].max()
        _fig = go.Figure()

        def create_traces(z_key, color_key):
            traces = []
            if color_key == 'n_courses':
                color_min, color_max = (min_courses, max_courses)
            elif color_key == 'n_entities':
                color_min, color_max = (min_entities, max_entities)
            else:
                color_min, color_max = (min_results, max_results)
            for alpha in alpha_values:
                x_line, y_line, z_line, color_line, hover_line = ([], [], [], [], [])
                for beta in beta_values:
                    if (alpha, beta) in grid_data:
                        point = grid_data[alpha, beta]
                        x_line.append(point['x'])
                        y_line.append(point['y'])
                        z_line.append(point[z_key])
                        color_line.append(point[color_key])
                        hover_line.append(point['hover'])
                if len(x_line) > 1:  # Determine color scale ranges for each metric
                    avg_color = sum(color_line) / len(color_line)
                    normalized_color = (avg_color - color_min) / (color_max - color_min) if color_max > color_min else 0
                    r = int(224 + normalized_color * (0 - 224))
                    g = int(242 + normalized_color * (30 - 242))
                    b = int(255 + normalized_color * (80 - 255))
                    traces.append(go.Scatter3d(x=x_line, y=y_line, z=z_line, mode='lines', line=dict(color=f'rgb({r}, {g}, {b})', width=2), text=hover_line, hoverinfo='text', showlegend=False, visible=False))
            for beta in beta_values:
                x_line, y_line, z_line, color_line, hover_line = ([], [], [], [], [])
                for alpha in alpha_values:
                    if (alpha, beta) in grid_data:  # Helper function to create traces for a given z metric and color metric
                        point = grid_data[alpha, beta]
                        x_line.append(point['x'])
                        y_line.append(point['y'])
                        z_line.append(point[z_key])  # Get color metric min/max
                        color_line.append(point[color_key])
                        hover_line.append(point['hover'])
                if len(x_line) > 1:
                    avg_color = sum(color_line) / len(color_line)
                    normalized_color = (avg_color - color_min) / (color_max - color_min) if color_max > color_min else 0  # total_results
                    r = int(224 + normalized_color * (0 - 224))
                    g = int(242 + normalized_color * (30 - 242))
                    b = int(255 + normalized_color * (80 - 255))  # Draw horizontal grid lines (constant alpha, varying beta)
                    traces.append(go.Scatter3d(x=x_line, y=y_line, z=z_line, mode='lines', line=dict(color=f'rgb({r}, {g}, {b})', width=2), text=hover_line, hoverinfo='text', showlegend=False, visible=False))
            return traces
        trace_sets = {}
        for z_key in ['z_courses', 'z_entities', 'z_total_results']:
            for color_key in ['n_courses', 'n_entities', 'total_results']:
                trace_sets[z_key, color_key] = create_traces(z_key, color_key)
        for (z_key, color_key), traces in trace_sets.items():
            for trace in traces:
                if z_key == 'z_courses' and color_key == 'total_results':
                    trace.visible = True
                _fig.add_trace(trace)
        _fig.add_trace(go.Scatter3d(x=[df['avg_course_completeness'].iloc[0]], y=[df['avg_runner_completeness'].iloc[0]], z=[df['n_courses'].iloc[0]], mode='markers', marker=dict(size=0.1, color=[min_results], colorscale=[[0, 'rgb(224, 242, 255)'], [1, 'rgb(0, 30, 80)']], showscale=True, colorbar=dict(title='Total Results', x=1.1, tickformat=','), cmin=min_results, cmax=max_results), showlegend=False, hoverinfo='skip', visible=True))  # Only draw if we have multiple points
        n_traces_per_combo = len(trace_sets['z_courses', 'n_courses'])  # Use average color for the line segment (very light to very dark blue)

        def make_visible_array(z_metric, color_metric):
            """Create visibility array for all traces."""
            visible = []  # Very light blue (224, 242, 255) to very dark blue (0, 30, 80)
            for z_key, color_key in trace_sets.keys():
                z_match = z_key == f'z_{z_metric}'
                color_match = color_key == color_metric
                visible.extend([z_match and color_match] * n_traces_per_combo)
            visible.append(True)
            return visible

        def get_color_title(color_metric):
            if color_metric == 'n_courses':
                return 'Course Count'
            elif color_metric == 'n_entities':
                return 'Total Entities'
            else:
                return 'Total Results'

        def get_color_range(color_metric):
            if color_metric == 'n_courses':  # Will be set to True for initial z metric
                return [min_courses, max_courses]
            elif color_metric == 'n_entities':
                return [min_entities, max_entities]  # Draw vertical grid lines (constant beta, varying alpha)
            else:
                return [min_results, max_results]
        _fig.update_layout(title=dict(text='Interactive 3D K-Core Parameter Space Wireframe', x=0.5, xanchor='center', font=dict(size=18)), scene=dict(xaxis=dict(title='Course Completeness', backgroundcolor='rgb(230, 230,230)', gridcolor='white', ticksuffix='%'), yaxis=dict(title='Runner Completeness', backgroundcolor='rgb(230, 230,230)', gridcolor='white', ticksuffix='%'), zaxis=dict(title='Course Count', backgroundcolor='rgb(230, 230,230)', gridcolor='white', separatethousands=True), camera=dict(eye=dict(x=1.5, y=-1.5, z=1.3))), width=1000, height=850, hovermode='closest', updatemenus=[dict(type='buttons', direction='left', buttons=[dict(label='Z-axis: Courses', method='update', args=[{'visible': make_visible_array('courses', 'total_results')}, {'scene.zaxis.title': 'Course Count', 'scene.zaxis.range': [0, df['n_courses'].max() * 1.1], 'scene.zaxis.separatethousands': True}]), dict(label='Z-axis: Total Entities', method='update', args=[{'visible': make_visible_array('entities', 'total_results')}, {'scene.zaxis.title': 'Total Entities (Courses + Runners)', 'scene.zaxis.range': [0, df['n_entities'].max() * 1.1], 'scene.zaxis.separatethousands': True}]), dict(label='Z-axis: Total Results', method='update', args=[{'visible': make_visible_array('total_results', 'total_results')}, {'scene.zaxis.title': 'Total Results', 'scene.zaxis.range': [0, df['total_results'].max() * 1.1], 'scene.zaxis.separatethousands': True}])], x=0.5, xanchor='center', y=1.08, yanchor='top', bgcolor='rgba(255, 255, 255, 0.8)', bordercolor='rgba(100, 100, 100, 0.5)', borderwidth=1), dict(type='buttons', direction='left', buttons=[dict(label='Color: Courses', method='update', args=[{'visible': make_visible_array('courses', 'n_courses')}, {'marker.colorbar.title': 'Course Count', 'marker.cmin': min_courses, 'marker.cmax': max_courses}]), dict(label='Color: Total Entities', method='update', args=[{'visible': make_visible_array('courses', 'n_entities')}, {'marker.colorbar.title': 'Total Entities', 'marker.cmin': min_entities, 'marker.cmax': max_entities}]), dict(label='Color: Total Results', method='update', args=[{'visible': make_visible_array('courses', 'total_results')}, {'marker.colorbar.title': 'Total Results', 'marker.cmin': min_results, 'marker.cmax': max_results}])], x=0.5, xanchor='center', y=1.03, yanchor='top', bgcolor='rgba(255, 255, 255, 0.8)', bordercolor='rgba(100, 100, 100, 0.5)', borderwidth=1)])
        return _fig
    # Visualize the parameter space with interactive 3D plot.
    # The figure serializes to ~24MB because of the 3×3 toggle matrix; we raise
    # marimo's output_max_bytes in analysis/pyproject.toml to accommodate.
    plot_3d_kcore_space(candidates_df=candidates_df, full_results=results)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    # Examining the (3, 840) K-Core

    We select **(α=3, β=840)** as the development core for the runner-effect model:

    - **α=3**: every runner started at least 3 core courses, enough repeat observations to separate a runner's ability from the courses they ran.
    - **β=840**: every course had at least 840 distinct core starters. This leaves 28 courses and about 140,000 results, small enough to sample runner and course effects in minutes. Loosen β for final fits.

    **Scope.** The core is a convenience sample, not a representative one: it keeps the biggest, longest-running races, most of them in the western US. It is for estimating how runner and course effects separate, not for statements about all races. Every runner and course in it is connected through shared races, which a model with both effects needs.

    ## Visualizing the Bipartite Structure

    The visualizations below show the runner-course relationships: clusters of runners who share similar race portfolios, courses that attract overlapping populations, and the connectivity that makes comparative inference possible.
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## Building the Subset

    We extract all results matching our k-core criteria and compute basic network statistics. The **degree** of a runner is the number of distinct courses they've started; the degree of a course is its number of distinct starters, across all its editions. These degree distributions tell us about the heterogeneity within our subset—are there a few "super-connectors" or is participation relatively uniform?
    """)
    return


@app.cell
def _(results, subset_kcore_data):
    # Build the (3, 840) subset
    alpha, beta = 3, 840

    kcore_subset = subset_kcore_data(results, alpha=alpha, beta=beta)
    kcore_data = kcore_subset[kcore_subset['in_kcore']].copy()

    # A course is `name` (the data source's course_id) across all its editions; label it by its latest race name without the year
    course_labels = (
        kcore_data.sort_values('race_date').groupby('name')['race_name'].last()
        .str.replace(r' \d{4} - ', ' - ', regex=True).to_dict()
    )

    # Degrees: distinct courses per runner, distinct runners per course
    runner_degrees = kcore_data.groupby('participant_id')['name'].nunique()
    course_degrees = kcore_data.groupby('name')['participant_id'].nunique()

    kcore_sample = kcore_data.copy()

    # Starts per runner-course pair, summed over editions
    edge_counts = kcore_sample.groupby(['participant_id', 'name']).size().reset_index(name='edge_weight')

    _model = kcore_subset[kcore_subset['in_kcore'] | kcore_subset['in_closure']]
    print(f"K-core (α={alpha}, β={beta}):")
    print(f"  Courses: {kcore_data['name'].nunique()} ({kcore_data['event_distance_id'].nunique()} editions, {kcore_data['year'].min()}-{kcore_data['year'].max()})")
    print(f"  Core runners: {kcore_data['participant_id'].nunique():,}")
    print(f"  Core results: {len(kcore_data):,}; with closure: {len(_model):,}")
    print(f"  Runner-course edges: {len(edge_counts):,} (max starts per pair: {edge_counts['edge_weight'].max()})")
    print(f"  DNF rate: core runners {1 - kcore_data['finished'].mean():.1%}, all starters at core courses {1 - _model['finished'].mean():.1%}")
    return (
        alpha,
        beta,
        course_labels,
        edge_counts,
        kcore_data,
        kcore_sample,
        runner_degrees,
    )


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## Adjacency Matrix Heatmap

    The adjacency matrix provides a bird's-eye view of runner-course relationships. Each row is a runner, each column is a course, and cells are colored by **percentile finish time** (darker = faster relative to that course's field).

    We apply **hierarchical clustering** to both rows and columns, reordering them to reveal latent structure. Look for:

    - **Block patterns**: Groups of runners who share similar race portfolios (they cluster together vertically) and tend to perform similarly across those races
    - **Color gradients**: Runners who consistently finish in similar percentiles across different courses (horizontal color consistency indicates stable relative ability)
    - **Sparse regions**: The gaps remind us that even within our dense k-core, not every runner-course combination is observed

    This matrix shows only the top 100 runners by degree for readability, but the patterns extend throughout the full dataset.
    """)
    return


@app.cell
def _(alpha, beta, course_labels, kcore_sample, pd, runner_degrees):
    import plotly.express as px
    from scipy.cluster.hierarchy import linkage, dendrogram
    from scipy.spatial.distance import pdist
    top_runners = runner_degrees.nlargest(100).index
    # Sample top 100 runners for adjacency matrix visualization
    kcore_matrix_sample = kcore_sample[kcore_sample['participant_id'].isin(top_runners)]
    matrix_data = kcore_matrix_sample.groupby(['participant_id', 'name'])['time_ms'].mean().reset_index()
    percentile_data = []
    # Create adjacency matrix with percentile finish times
    for event_id in matrix_data['name'].unique():
        course_times = kcore_matrix_sample[kcore_matrix_sample['name'] == event_id]['time_ms']
    # Calculate percentile for each course
        participant_times = matrix_data[matrix_data['name'] == event_id].copy()
        participant_times['percentile'] = participant_times['time_ms'].rank(pct=True) * 100
        percentile_data.append(participant_times)  # Get all finish times for this course
    percentile_df = pd.concat(percentile_data, ignore_index=True)
    matrix = percentile_df.pivot(index='participant_id', columns='name', values='percentile')
    matrix_filled = matrix.fillna(matrix.median().median())  # Get participant times for this course
    row_linkage = linkage(pdist(matrix_filled, metric='euclidean'), method='ward')
    row_dendrogram = dendrogram(row_linkage, no_plot=True)
    row_order = row_dendrogram['leaves']  # Calculate percentile rank (0-100)
    col_linkage = linkage(pdist(matrix_filled.T, metric='euclidean'), method='ward')
    col_dendrogram = dendrogram(col_linkage, no_plot=True)
    col_order = col_dendrogram['leaves']
    matrix_clustered = matrix.iloc[row_order, col_order]
    # Combine all percentiles
    runner_names = kcore_matrix_sample[['participant_id', 'first_name', 'last_name']].drop_duplicates('participant_id').set_index('participant_id')
    runner_names['full_name'] = runner_names['first_name'] + ' ' + runner_names['last_name']
    # Create matrix with percentiles
    matrix_clustered_with_names = matrix_clustered.copy()
    matrix_clustered_with_names.index = [runner_names.loc[pid, 'full_name'] if pid in runner_names.index else str(pid) for pid in matrix_clustered.index]
    # Fill NaN values with median for clustering (represents missing races)
    matrix_clustered_with_names.columns = [course_labels.get(col, str(col)) for col in matrix_clustered_with_names.columns]
    # Perform hierarchical clustering on rows (runners)
    _fig = px.imshow(matrix_clustered_with_names, aspect='auto', color_continuous_scale='Viridis', labels=dict(color='Percentile', x='Course', y='Runner'), title=f'Runner × Course Adjacency Matrix (α={alpha}, β={beta}, Top 100 Runners)<br><sub>Color = Percentile Finish Time (higher = slower) | Hierarchically Clustered</sub>')
    _fig.update_layout(width=1200, height=800, xaxis=dict(tickangle=-45, tickfont=dict(size=8), showgrid=False, showline=False, showticklabels=False, title=''), yaxis=dict(tickfont=dict(size=6), showgrid=False, showline=False, showticklabels=False, title=''), plot_bgcolor='white', paper_bgcolor='white')
    # Perform hierarchical clustering on columns (courses)
    # Reorder matrix using clustering results
    # Get runner names for hover text
    # Create custom hover text with runner names
    # Get race names for column labels - keep event_distance_id to ensure uniqueness
    # Create unique labels by combining name with event_distance_id
    _fig
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## Force-Directed Network

    The final visualization presents the k-core as a **force-directed network graph**. This physics-inspired layout treats edges as springs and nodes as mutually-repelling particles, letting the graph "relax" into a natural arrangement where connected nodes cluster together.

    ### Super-Node Compression

    With thousands of runners, a naive visualization would be overwhelming. We address this by creating **super-nodes**: runners with *identical* race participation patterns are merged into a single node. This is semantically meaningful—runners who've done exactly the same set of races are essentially interchangeable from a network topology perspective.

    The resulting graph reveals:
    - **Central hubs**: Courses that attract runners from across the community (high connectivity)
    - **Peripheral clusters**: Regional or niche race circuits with dedicated but isolated participant pools
    - **Bridge nodes**: Runners or courses that connect otherwise-separate sub-communities

    **Interactive features**: Hover over any node to highlight its connections. Course nodes appear in coral; runner groups in the Viridis colorscale (colored by degree).
    """)
    return


@app.cell
def _(course_labels, kcore_sample):
    runner_signatures = {}
    for _runner_id in kcore_sample['participant_id'].unique():
        races = frozenset(kcore_sample[kcore_sample['participant_id'] == _runner_id]['name'])
        runner_signatures[_runner_id] = races
    unique_signatures = {}
    for _runner_id, _sig in runner_signatures.items():
        if _sig not in unique_signatures:
            unique_signatures[_sig] = set()
        unique_signatures[_sig].add(_runner_id)
    unique_courses = sorted(kcore_sample['name'].unique())
    runner_names_1 = kcore_sample[['participant_id', 'first_name', 'last_name']].drop_duplicates('participant_id')
    runner_names_1 = {row['participant_id']: f"{row['first_name']} {row['last_name']}" for _, row in runner_names_1.iterrows()}
    race_names = course_labels
    print(f'Created {len(unique_signatures):,} super-nodes from {len(runner_signatures):,} runners')
    print(f'Average group size: {len(runner_signatures) / len(unique_signatures):.1f} runners per super-node')
    print(f'Largest group: {max((len(runners) for runners in unique_signatures.values()))} runners')
    print(f'Total courses: {len(unique_courses)}')
    return race_names, runner_names_1, unique_courses, unique_signatures


@app.cell
def _(
    alpha,
    beta,
    edge_counts,
    go,
    ig,
    mo,
    np,
    race_names,
    runner_names_1,
    unique_courses,
    unique_signatures,
):
    import time
    import json
    start_time = time.time()
    edges = []
    edge_weights = {}
    runner_to_super = {}
    for super_idx, (_sig, runners) in enumerate(unique_signatures.items()):
        for _runner_id in runners:
            runner_to_super[_runner_id] = super_idx
    course_to_idx = {course_id: idx for idx, course_id in enumerate(unique_courses)}
    for _, row in edge_counts.iterrows():
        _runner_id = row['participant_id']
        course_id = row['name']
        if _runner_id in runner_to_super:
            super_idx = runner_to_super[_runner_id]
            course_idx = len(unique_signatures) + course_to_idx[course_id]
            edge_key = (super_idx, course_idx)
            edge_weights[edge_key] = edge_weights.get(edge_key, 0) + row['edge_weight']
    edges = list(edge_weights.keys())
    layout_start = time.time()
    g = ig.Graph.Bipartite([0] * len(unique_signatures) + [1] * len(unique_courses), edges)
    layouts = {}
    fr_start = time.time()
    base_layout = g.layout_fruchterman_reingold(niter=10000, grid='auto')
    layouts['Fruchterman-Reingold'] = base_layout
    degrees = g.degree()
    runner_names_list = []
    for _sig in unique_signatures.keys():
        runners = unique_signatures[_sig]
        if len(runners) == 1:
            _runner_id = list(runners)[0]
            runner_names_list.append(runner_names_1.get(_runner_id, f'Runner {_runner_id}'))
        else:
            runner_names_list.append(f'{len(runners)} runners')
    course_names_list = [race_names.get(c, f'Course {c}') for c in unique_courses]
    _fig = go.Figure()

    def add_optimized_layout(fig, layout):
        """Add layout with optimized edge rendering using dual traces."""
        pos_x = [coord[0] for coord in layout.coords]
        pos_y = [coord[1] for coord in layout.coords]
        edge_x = []
        edge_y = []
        node_to_segments = {}
        node_neighbors = {}
        segment_idx = 0
        for edge_idx, edge in enumerate(g.es):
            source, target = edge.tuple
            if source not in node_to_segments:
                node_to_segments[source] = []
                node_neighbors[source] = []
            if target not in node_to_segments:
                node_to_segments[target] = []
                node_neighbors[target] = []
            node_to_segments[source].append(segment_idx)
            node_to_segments[target].append(segment_idx)
            node_neighbors[source].append(target)
            node_neighbors[target].append(source)
            edge_x.extend([pos_x[source], pos_x[target], None])
            edge_y.extend([pos_y[source], pos_y[target], None])
            segment_idx = segment_idx + 1
        _fig.add_trace(go.Scattergl(x=edge_x, y=edge_y, mode='lines', line=dict(width=0.5, color='rgba(200,200,200,0.3)'), hoverinfo='skip', name='base_edges', showlegend=False))
        _fig.add_trace(go.Scattergl(x=[], y=[], mode='lines', line=dict(width=2, color='rgba(255,50,50,0.9)'), hoverinfo='skip', name='highlight_edges', showlegend=False))
        super_node_indices = list(range(len(unique_signatures)))
        course_indices = list(range(len(unique_signatures), len(unique_signatures) + len(unique_courses)))
        super_node_sizes = []
        super_node_degrees = []
        super_node_hover_text = []
        for idx, (_sig, runners) in enumerate(unique_signatures.items()):
            group_size = len(runners)
            super_node_sizes.append(3 + np.log1p(group_size) * 2)
            super_node_degrees.append(degrees[idx])
            if group_size == 1:
                _runner_id = list(runners)[0]
                name = runner_names_1.get(_runner_id, f'Runner {_runner_id}')
                super_node_hover_text.append(f'{name}<br>Degree: {degrees[idx]}')
            else:
                sample_names = [runner_names_1.get(r, f'Runner {r}') for r in list(runners)[:3]]
                hover = f'Group of {group_size} runners<br>' + '<br>'.join(sample_names)
                if group_size > 3:
                    hover = hover + f'<br>... and {group_size - 3} more'
                hover = hover + f'<br>Degree: {degrees[idx]}'
                super_node_hover_text.append(hover)
        course_hover_text = [f'{course_names_list[i]}<br>Degree: {degrees[len(unique_signatures) + i]}' for i in range(len(unique_courses))]
        course_sizes = [2 + np.log1p(degrees[i]) * 1.5 for i in course_indices]
        _fig.add_trace(go.Scattergl(x=[pos_x[i] for i in super_node_indices], y=[pos_y[i] for i in super_node_indices], mode='markers', marker=dict(size=super_node_sizes, color=super_node_degrees, colorscale='Viridis', showscale=False, symbol='circle', opacity=0.6, line=dict(width=0)), text=super_node_hover_text, hoverinfo='text', name='Runner Groups', showlegend=False, customdata=[[i] for i in super_node_indices]))
        _fig.add_trace(go.Scattergl(x=[pos_x[i] for i in course_indices], y=[pos_y[i] for i in course_indices], mode='markers', marker=dict(size=course_sizes, color='coral', symbol='circle', opacity=0.6, line=dict(width=0)), text=course_hover_text, hoverinfo='text', name='Courses', showlegend=False, customdata=[[i] for i in course_indices]))
        _fig.add_trace(go.Scattergl(x=[], y=[], mode='markers', marker=dict(size=[], color=[], colorscale='Viridis', symbol='circle', opacity=1.0, line=dict(width=2, color='white')), text=[], hoverinfo='text', name='highlight_runners', showlegend=False))
        _fig.add_trace(go.Scattergl(x=[], y=[], mode='markers', marker=dict(size=[], color='coral', symbol='circle', opacity=1.0, line=dict(width=2, color='white')), text=[], hoverinfo='text', name='highlight_courses', showlegend=False))
        return (node_to_segments, edge_x, edge_y, node_neighbors, pos_x, pos_y, super_node_sizes, super_node_degrees, super_node_hover_text, course_hover_text, course_sizes)
    node_to_segs, base_edge_x, base_edge_y, node_neighbors, pos_x, pos_y, runner_sizes, runner_degrees_1, runner_hover, course_hover, course_sizes = add_optimized_layout(_fig, layouts['Fruchterman-Reingold'])
    connectivity_data = {'node_to_segments': {str(k): v for k, v in node_to_segs.items()}, 'node_neighbors': {str(k): v for k, v in node_neighbors.items()}, 'base_edge_x': base_edge_x, 'base_edge_y': base_edge_y, 'pos_x': pos_x, 'pos_y': pos_y, 'runner_sizes': runner_sizes, 'runner_degrees': runner_degrees_1, 'runner_hover': runner_hover, 'course_hover': course_hover, 'course_sizes': course_sizes}
    _fig.update_layout(title=f"Bipartite Network: Runner Groups × Courses (α={alpha}, β={beta})<br><sub>10k iterations with grid='auto' for overlap prevention + smaller nodes</sub>", showlegend=False, hovermode='closest', width=1200, height=700, plot_bgcolor='white', uirevision='constant')
    _fig.update_xaxes(showgrid=False, zeroline=False, showticklabels=False)
    _fig.update_yaxes(showgrid=False, zeroline=False, showticklabels=False)
    import plotly.io as pio
    html_str = pio.to_html(_fig, include_plotlyjs='cdn', full_html=False)
    optimized_js = f"""\n<div id="connectivity-data" style="display:none;">{json.dumps(connectivity_data)}</div>\n<script>\n(function() {{\n    function initOptimizedHover() {{\n        var allPlotlyDivs = document.querySelectorAll('.plotly-graph-div');\n        var gd = allPlotlyDivs[allPlotlyDivs.length - 1];\n        \n        if (!gd || !gd.data) {{\n            setTimeout(initOptimizedHover, 100);\n            return;\n        }}\n        \n        // Load connectivity data\n        var connectivityData = JSON.parse(document.getElementById('connectivity-data').textContent);\n        var nodeToSegments = connectivityData.node_to_segments;\n        var nodeNeighbors = connectivityData.node_neighbors;\n        var cachedBaseX = connectivityData.base_edge_x;\n        var cachedBaseY = connectivityData.base_edge_y;\n        var posX = connectivityData.pos_x;\n        var posY = connectivityData.pos_y;\n        var runnerSizes = connectivityData.runner_sizes;\n        var runnerDegrees = connectivityData.runner_degrees;\n        var runnerHover = connectivityData.runner_hover;\n        var courseHover = connectivityData.course_hover;\n        var courseSizes = connectivityData.course_sizes;\n        \n        // Find trace indices\n        var baseTraceIdx = -1;\n        var highlightTraceIdx = -1;\n        var runnerTraceIdx = -1;\n        var courseTraceIdx = -1;\n        var highlightRunnerTraceIdx = -1;\n        var highlightCourseTraceIdx = -1;\n        \n        gd.data.forEach(function(trace, i) {{\n            if (trace.name === 'base_edges') baseTraceIdx = i;\n            else if (trace.name === 'highlight_edges') highlightTraceIdx = i;\n            else if (trace.name === 'Runner Groups') runnerTraceIdx = i;\n            else if (trace.name === 'Courses') courseTraceIdx = i;\n            else if (trace.name === 'highlight_runners') highlightRunnerTraceIdx = i;\n            else if (trace.name === 'highlight_courses') highlightCourseTraceIdx = i;\n        }});\n        \n        if (baseTraceIdx === -1 || highlightTraceIdx === -1) return;\n        \n        // Store original node data\n        var originalRunnerData = {{\n            marker: {{\n                opacity: gd.data[runnerTraceIdx].marker.opacity\n            }}\n        }};\n        \n        var originalCourseData = {{\n            marker: {{\n                opacity: gd.data[courseTraceIdx].marker.opacity\n            }}\n        }};\n        \n        // Recursive handler attachment function\n        function attachHoverHandlers(gd, highlightTraceIdx) {{\n            gd.removeAllListeners('plotly_hover');\n            gd.removeAllListeners('plotly_unhover');\n            \n            // Hover handler\n            gd.on('plotly_hover', function(data) {{\n                if (!data.points || data.points.length === 0) return;\n                \n                var point = data.points[0];\n                if (point.data.mode !== 'markers' || !point.data.customdata) return;\n                \n                var nodeIdx = point.data.customdata[point.pointIndex][0];\n                var connectedSegments = nodeToSegments[nodeIdx.toString()] || [];\n                var neighbors = nodeNeighbors[nodeIdx.toString()] || [];\n                \n                if (connectedSegments.length === 0) return;\n                \n                // Build highlight coordinates\n                var highlightX = [];\n                var highlightY = [];\n                for (var i = 0; i < connectedSegments.length; i++) {{\n                    var segIdx = connectedSegments[i];\n                    var startIdx = segIdx * 3;\n                    highlightX.push(cachedBaseX[startIdx], cachedBaseX[startIdx + 1], null);\n                    highlightY.push(cachedBaseY[startIdx], cachedBaseY[startIdx + 1], null);\n                }}\n                \n                // Dim original nodes\n                var runnerOpacity = new Array(gd.data[runnerTraceIdx].x.length).fill(0.2);\n                var courseOpacity = new Array(gd.data[courseTraceIdx].x.length).fill(0.2);\n                \n                // Build highlighted node data (these will appear on top with borders)\n                var highlightRunnerX = [];\n                var highlightRunnerY = [];\n                var highlightRunnerSizes = [];\n                var highlightRunnerColors = [];\n                var highlightRunnerText = [];\n                \n                var highlightCourseX = [];\n                var highlightCourseY = [];\n                var highlightCourseSizes = [];\n                var highlightCourseText = [];\n                \n                neighbors.forEach(function(neighborIdx) {{\n                    if (neighborIdx < gd.data[runnerTraceIdx].x.length) {{\n                        // It's a runner - add to highlight trace\n                        highlightRunnerX.push(posX[neighborIdx]);\n                        highlightRunnerY.push(posY[neighborIdx]);\n                        highlightRunnerSizes.push(runnerSizes[neighborIdx]);\n                        highlightRunnerColors.push(runnerDegrees[neighborIdx]);\n                        highlightRunnerText.push(runnerHover[neighborIdx]);\n                    }} else {{\n                        // It's a course - add to highlight trace\n                        var courseArrayIdx = neighborIdx - gd.data[runnerTraceIdx].x.length;\n                        highlightCourseX.push(posX[neighborIdx]);\n                        highlightCourseY.push(posY[neighborIdx]);\n                        highlightCourseSizes.push(courseSizes[courseArrayIdx]);\n                        highlightCourseText.push(courseHover[courseArrayIdx]);\n                    }}\n                }});\n                \n                // Update all traces\n                Plotly.update(gd, \n                    {{\n                        x: [highlightX],\n                        y: [highlightY]\n                    }}, \n                    {{}},\n                    [highlightTraceIdx]\n                ).then(function() {{\n                    return Plotly.restyle(gd, {{'marker.opacity': runnerOpacity}}, [runnerTraceIdx]);\n                }}).then(function() {{\n                    return Plotly.restyle(gd, {{'marker.opacity': courseOpacity}}, [courseTraceIdx]);\n                }}).then(function() {{\n                    return Plotly.restyle(gd, {{\n                        x: [highlightRunnerX],\n                        y: [highlightRunnerY],\n                        'marker.size': [highlightRunnerSizes],\n                        'marker.color': [highlightRunnerColors],\n                        text: [highlightRunnerText]\n                    }}, [highlightRunnerTraceIdx]);\n                }}).then(function() {{\n                    return Plotly.restyle(gd, {{\n                        x: [highlightCourseX],\n                        y: [highlightCourseY],\n                        'marker.size': [highlightCourseSizes],\n                        text: [highlightCourseText]\n                    }}, [highlightCourseTraceIdx]);\n                }}).then(function() {{\n                    attachHoverHandlers(gd, highlightTraceIdx);\n                }});\n            }});\n            \n            // Unhover handler\n            gd.on('plotly_unhover', function() {{\n                // Reset everything\n                Plotly.update(gd,\n                    {{\n                        x: [[]],\n                        y: [[]]\n                    }},\n                    {{}},\n                    [highlightTraceIdx]\n                ).then(function() {{\n                    return Plotly.restyle(gd, {{\n                        'marker.opacity': originalRunnerData.marker.opacity\n                    }}, [runnerTraceIdx]);\n                }}).then(function() {{\n                    return Plotly.restyle(gd, {{\n                        'marker.opacity': originalCourseData.marker.opacity\n                    }}, [courseTraceIdx]);\n                }}).then(function() {{\n                    return Plotly.restyle(gd, {{\n                        x: [[]],\n                        y: [[]],\n                        'marker.size': [[]],\n                        'marker.color': [[]],\n                        text: [[]]\n                    }}, [highlightRunnerTraceIdx]);\n                }}).then(function() {{\n                    return Plotly.restyle(gd, {{\n                        x: [[]],\n                        y: [[]],\n                        'marker.size': [[]],\n                        text: [[]]\n                    }}, [highlightCourseTraceIdx]);\n                }}).then(function() {{\n                    attachHoverHandlers(gd, highlightTraceIdx);\n                }});\n            }});\n        }}\n        \n        // Initial handler attachment\n        attachHoverHandlers(gd, highlightTraceIdx);\n    }}\n    \n    if (document.readyState === 'loading') {{\n        document.addEventListener('DOMContentLoaded', initOptimizedHover);\n    }} else {{\n        initOptimizedHover();\n    }}\n}})();\n</script>\n"""
    full_html = f'\n<div>\n{html_str}\n{optimized_js}\n</div>\n'
    _network_html = mo.Html(full_html)
    _network_html
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ---

    # Summary

    The (3, 840)-core is the dense, connected subset of runners and courses that a model with runner effects needs. It is saved (see Handoff) for the runner-effect finish-time model, which fits on it; the course-only model (nb 1) and the reporting model (nb 2) use all the data and need no core.

    The input is every start (finish or DNF) at marathon distance or longer. DNFs count as edges so that runners who often drop are not excluded from the core.
    """)
    return


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    ## Handoff

    The chosen core is saved as `data/cache/0.1_kcore/core.parquet` (one row per runner and course in the core, plus the α and β used), with the closure flags available by re-running `subset_kcore_data` on the same input. A larger core for final fits, (3, 500) with 172 courses, is saved as `core_3_500.parquet`; later notebooks pick a core with their `CORE` constant.
    """)
    return


@app.cell
def _(Path, alpha, beta, kcore_data, results, subset_kcore_data):
    _out = Path(__file__).resolve().parent.parent / 'data' / 'cache' / '0.1_kcore'
    core_members = kcore_data[['participant_id', 'name']].drop_duplicates().assign(alpha=alpha, beta=beta)
    core_members.to_parquet(_out / 'core.parquet', index=False)
    # Larger cores for final fits, saved alongside the dev core (core_<alpha>_<beta>.parquet).
    for _a, _b in [(3, 500)]:
        _flagged = subset_kcore_data(results, alpha=_a, beta=_b)
        _flagged.loc[_flagged['in_kcore'], ['participant_id', 'name']].drop_duplicates().assign(alpha=_a, beta=_b).to_parquet(_out / f'core_{_a}_{_b}.parquet', index=False)
    print(f"Saved the dev core ({core_members['participant_id'].nunique():,} runners x {core_members['name'].nunique()} courses) and the final-fit cores")
    return


if __name__ == "__main__":
    app.run()
